# aframe-materialx-component

**materialx** is a drop-in replacement for the **material** component, which adds the ability to **name** and  **remap** materials. Remapping is useful for changing the materials on imported models.

By default this component applies the material to the object returned by `getObject3D("mesh")` (the standard object used by AFrame).  If **remap** is set then, this material replaces existing materials which have a name matching the **remap**, where `*` is a special character which will match any string (even an empty string), and `?` will match any single character (including no character).

[Click for demo](https://harlyq.github.io/aframe-materialx-component/)

![Screenshot](assets/screenshot.jpg)

## Example

```html
<head>
  <script src="https://aframe.io/releases/0.8.2/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-materialx-component@^0.1.0/aframe-materialx-component.js"></script>
</head>
<body>
  <a-scene>
    <a-entity position="0 0 -5" materialx="remap: Bar_A_mat; color: green; wireframe: true" gltf-model="url(assets/bar/bar.gltf)"></a-entity>
  </a-scene>
</body>
```

## Properties

**name** - defines the name for this material (*string*) default is ""

**remap** - defines a glob (case sensitive) which matches a name of an existing material in a geometry (*string*) default is ""

## remap examples

`*` - matches any name, including a material without a name

`test*map` - matches *testAABBmap*, *testmap*, *test1map*, but not *TestMap* (incorrect capitilization)

`House?` - matches *House1*, *HouseA*, *House* but fails on *house1* (h when expecting H) or *HouseAA* (two characters after House)

`0.default` - only matches *0.default*

Note: the characters `*` and `?` cannot be matched in a name, use `?` to skip them

