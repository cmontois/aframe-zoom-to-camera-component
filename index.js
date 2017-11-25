if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

const THREE = window.THREE
const degToRad = window.THREE.Math.degToRad

var animationPlaying = false
var animationCompleted = false

AFRAME.registerComponent('zoom-front-camera', {

  schema: {
    zooming: {type: 'boolean'}
  },

  _cameraEntity:     null,  //Camera Entity

  _threeElement:     null,  //this.el in ThreeJS (Object3D)
  _threeCamera:      null,  //Camera entity in ThreeJS (Object3D)
  _initialQuaternion:null,  //Initial Quaternion property
  _initialPosition:  null,  //Initial Position property
  _targetQuaternion: null,  //Target Quaternion property
  _targetPosition:   null,  //Target Position property

  //Initialize var, add the event listeners & call the function to change element position
  init: function() {
    this._cameraEntity = this.el.sceneEl.camera.el

    this.el.addEventListener('animation__position-begin', function() {
      animationPlaying = true
    })

    this.el.addEventListener('animation__position-complete', function() {
      animationPlaying = false
      animationCompleted = true
    })

    this.retrieveDatas()
  },

  update: function() {
    return (this.data.zooming) ? this.tweenHotspotToCamera(false) : this.tweenHotspotToCamera(true)
  },

  //Loop Function to update the rotation of the element during the position changement (by using Quaternion)
  tick: function() {

    if(animationCompleted) {
      //Bind reversed zoom event on click
      var clickEvent = {
        '_event': 'click',
        'zoom-front-camera.zooming': !this.data.zooming
      }

      this.el.setAttribute('event-set__click', clickEvent)

      //Reinitialize animation
      animationCompleted = false
      return
    }

    if(!animationPlaying)
      return

    return (this.data.zooming)
      ? this.slerpEffect(this._initialPosition, this._targetPosition, this._initialQuaternion, this._targetQuaternion)
      : this.slerpEffect(this._targetPosition, this._initialPosition, this._targetQuaternion, this._initialQuaternion)
  },

  retrieveDatas: function() {
    this._threeElement = this.el.object3D
    this._threeCamera = this._cameraEntity.object3D

    //Copy the initial datas
    this._initialPosition = this._threeElement.position.clone()
    this._initialQuaternion = this._threeElement.quaternion.clone()

    //Some maths to obtain objects around the same size of the screen

    //Retrieving the Field of View (FOV) from the camera attribute
    const fov = this._cameraEntity.getAttribute('camera').fov

    //Convert fov + reduce it
    var fovInRad = degToRad(fov) / 2
    var ratio=window.innerWidth/window.innerHeight //Assuming the FOV is vertical
    var pLocal,cPos

    var bbox=getCompoundBoundingBox(this._threeElement)
    var sizeY = bbox.max.y-bbox.min.y
    var sizeX = bbox.max.x-bbox.min.x

    sizeX*=this._threeElement.scale.x
    sizeY*=this._threeElement.scale.y

    var tanFov = Math.tan(fovInRad)
    var distY = sizeY/tanFov
    var distX = ((sizeX/(ratio*tanFov)) < distY) ? distY : sizeX/(ratio*tanFov)

    pLocal= new THREE.Vector3(0, 0, -distX)

    cPos = this._threeCamera.position.clone()
    cPos.y -= 1.5

    //Apply the direction the camera is facing
    this._targetPosition = pLocal.applyMatrix4(this._threeCamera.matrixWorld)

    var targetLook = cPos.applyMatrix4(this._threeCamera.matrixWorld)
    this._threeElement.position.copy(this._targetPosition)
    this._threeElement.lookAt(targetLook)
    this._targetQuaternion=this._threeElement.quaternion.clone()

    //Take the original data back
    this._threeElement.position.copy(this._initialPosition)
    this._threeElement.quaternion.copy(this._initialQuaternion)
  },

  tweenHotspotToCamera: function(reversed) {

    //Animation
    const positionAnimation = {
      property:     'position',
      from:         this._threeElement.position,
      to:           (reversed) ? this._initialPosition : this._targetPosition,
      dur:          2000,
      easing:       'easeInOutCubic',
      startEvents:  ['---non-existent-event---'] //Avoid auto-play of the animation
    }

    //Set the animation on the element
    this.el.setAttribute('animation__position', positionAnimation)

    //Retrieve the animation
    const animation = this.el.components.animation__position.animation

    if(animation)
      animation.play()
  },

  slerpEffect: function(initialP, finalP, initialQ, finalQ) {
    var dstF= initialP.distanceTo(finalP)
    var dstC= initialP.distanceTo(this._threeElement.position)
    var k=dstC/dstF

    THREE.Quaternion.slerp(initialQ, finalQ, this._threeElement.quaternion, k)

    //Because few images are disappearing when you click on them
    this.el.setAttribute('visible', true)
  }
})

/**
 * Get the size of the given object
 *
 * @param object3D
 * @returns {*}
 */
function getCompoundBoundingBox(object3D) {
  var box = null
  object3D.traverse(function (obj3D) {
    var geometry = obj3D.geometry
    if (geometry === undefined) return
    geometry.computeBoundingBox()
    if (box === null)
      box = geometry.boundingBox
    else
      box.union(geometry.boundingBox)
  })
  return box
}