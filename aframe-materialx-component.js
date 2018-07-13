// modification of the 'material' component from https://aframe.io/releases/0.8.2/aframe.min.js

(function() {

var utils = AFRAME.utils;

var error = utils.debug('components:materialx:error');
var shaders = AFRAME.shaders;

/**
 * Material component.
 *
 * @member {object} shader - Determines how material is shaded. Defaults to `standard`,
 *         three.js's implementation of PBR. Another standard shading model is `flat` which
 *         uses MeshBasicMaterial.
 */
AFRAME.registerComponent('materialx', {
  schema: {
    alphaTest: {default: 0.0, min: 0.0, max: 1.0},
    depthTest: {default: true},
    depthWrite: {default: true},
    flatShading: {default: false},
    name: {default: ""},
    npot: {default: false},
    offset: {type: 'vec2', default: {x: 0, y: 0}},
    opacity: {default: 1.0, min: 0.0, max: 1.0},
    remap: {default: ''},
    repeat: {type: 'vec2', default: {x: 1, y: 1}},
    shader: {default: 'standard', oneOf: Object.keys(AFRAME.shaders)},
    side: {default: 'front', oneOf: ['front', 'back', 'double']},
    transparent: {default: false},
    vertexColors: {type: 'string', default: 'none', oneOf: ['face', 'vertex']},
    visible: {default: true},
  },

  multiple: true,

  init: function () {
    this.system = this.el.sceneEl.systems['material'];
    this.material = null;
  },

  /**
   * Update or create material.
   *
   * @param {object|null} oldData
   */
  update: function (oldData) {
    var data = this.data;
    if (!this.shader || data.shader !== oldData.shader) {
      this.updateShader(data.shader);
    }
    this.shader.update(this.data);
    this.updateMaterial(oldData);
  },

  updateSchema: function (data) {
    var newShader = data.shader;
    var currentShader = this.data && this.data.shader;
    var shader = newShader || currentShader;
    var schema = shaders[shader] && shaders[shader].schema;
    if (!schema) { error('Unknown shader schema ' + shader); }
    if (currentShader && newShader === currentShader) { return; }
    this.extendSchema(schema);
    this.updateBehavior();
  },

  updateBehavior: function () {
    var schema = this.schema;
    var self = this;
    var sceneEl = this.el.sceneEl;
    var tickProperties = {};
    var tick = function (time, delta) {
      Object.keys(tickProperties).forEach(function update (key) {
        tickProperties[key] = time;
      });
      self.shader.update(tickProperties);
    };
    this.tick = undefined;
    Object.keys(schema).forEach(function (key) {
      if (schema[key].type === 'time') {
        self.tick = tick;
        tickProperties[key] = true;
      }
    });
    if (!sceneEl) { return; }
    if (!this.tick) {
      sceneEl.removeBehavior(this);
    } else {
      sceneEl.addBehavior(this);
    }
  },

  updateShader: function (shaderName) {
    var data = this.data;
    var Shader = shaders[shaderName] && shaders[shaderName].Shader;
    var shaderInstance;

    if (!Shader) { throw new Error('Unknown shader ' + shaderName); }

    // Get material from A-Frame shader.
    shaderInstance = this.shader = new Shader();
    shaderInstance.el = this.el;
    shaderInstance.init(data);
    this.setMaterial(shaderInstance.material);
    this.updateSchema(data);
  },

  /**
   * Set and update base material properties.
   * Set `needsUpdate` when needed.
   */
  updateMaterial: function (oldData) {
    var data = this.data;
    var material = this.material;

    // Base material properties.
    material.alphaTest = data.alphaTest;
    material.depthTest = data.depthTest !== false;
    material.depthWrite = data.depthWrite !== false;
    material.name = data.name;
    material.opacity = data.opacity;
    material.flatShading = data.flatShading;
    material.side = parseSide(data.side);
    material.transparent = data.transparent !== false || data.opacity < 1.0;
    material.vertexColors = parseVertexColors(data.vertexColors);
    material.visible = data.visible;

    // Check if material needs update.
    if (Object.keys(oldData).length &&
        (oldData.alphaTest !== data.alphaTest ||
         oldData.side !== data.side ||
         oldData.vertexColors !== data.vertexColors)) {
      material.needsUpdate = true;
    }
  },

  /**
   * Remove material on remove (callback).
   * Dispose of it from memory and unsubscribe from scene updates.
   */
  remove: function () {
    var defaultMaterial = new THREE.MeshBasicMaterial();
    var material = this.material;
    replaceMaterial(this.el, this.data.remap, defaultMaterial);
    disposeMaterial(material, this.system);
  },

  /**
   * (Re)create new material. Has side-effects of setting `this.material` and updating
   * material registration in scene.
   *
   * @param {object} data - Material component data.
   * @param {object} type - Material type to create.
   * @returns {object} Material.
   */
  setMaterial: function (material) {
    var el = this.el;
    var system = this.system;
    var remapName = this.data.remap;

    if (this.material) { disposeMaterial(this.material, system); }

    this.material = material;
    system.registerMaterial(material);

    // Set on mesh. If mesh does not exist, wait for it.
    if (!replaceMaterial(el, remapName, material)) {

      el.addEventListener('object3dset', function waitForMesh (evt) {
        if (evt.target !== el) { return; }
        if (!replaceMaterial(el, remapName, material)) { return; }
        el.removeEventListener('object3dset', waitForMesh);
      });
    }
  },

});

/**
 * Return a three.js constant determining which material face sides to render
 * based on the side parameter (passed as a component property).
 *
 * @param {string} [side=front] - `front`, `back`, or `double`.
 * @returns {number} THREE.FrontSide, THREE.BackSide, or THREE.DoubleSide.
 */
function parseSide (side) {
  switch (side) {
    case 'back': {
      return THREE.BackSide;
    }
    case 'double': {
      return THREE.DoubleSide;
    }
    default: {
      // Including case `front`.
      return THREE.FrontSide;
    }
  }
}

/**
 * Return a three.js constant determining vertex coloring.
 */
function parseVertexColors (coloring) {
  switch (coloring) {
    case 'face': {
      return THREE.FaceColors;
    }
    case 'vertex': {
      return THREE.VertexColors;
    }
    default: {
      return THREE.NoColors;
    }
  }
}

/**
 * Dispose of material from memory and unsubscribe material from scene updates like fog.
 */
function disposeMaterial (material, system) {
  material.dispose();
  system.unregisterMaterial(material);
}

/**
 * Replace all materials of a given name with a new material.
 * 
 * @param {object} el - element to replace material on
 * @param {string} name - name of the material to replace, use "*" for all materials or "" for the material of getObject3D("mesh")
 * @param {object} newMaterial - new material to use
 */
function replaceMaterial (el, name, newMaterial) {
  var count = 0;

  if (name === "") {
    let object3D = el.getObject3D("mesh");
    if (object3D && object3D.material) {
      object3D.material = newMaterial;
      count = 1;
    }
  } else {
    let object3D = el.object3D;
    if (object3D) {
      object3D.traverse(function (obj) {
        if (obj && obj.material) {
          if (Array.isArray(obj.material)) {
            for (var i = 0, n = obj.material.length; i < n; i++) {
              if (name === "*" || obj.material[i].name === name) {
                obj.material[i] = newMaterial;
                count++;
              }
            }
          } else if (name === "*" || obj.material.name === name) {
            obj.material = newMaterial;
            count++;
          }
        }
      })
    }
  }

  return count
}

})()
