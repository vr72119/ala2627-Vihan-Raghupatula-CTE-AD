import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const SCALE = 0.05;
const WORLD = { width: 3600, height: 2400 };
const host = document.querySelector('#three-scene');
const frame = host?.parentElement;

if (host && frame) {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111a19');
    scene.fog = new THREE.FogExp2('#111a19', 0.012);
    const camera = new THREE.PerspectiveCamera(57, host.clientWidth / host.clientHeight, 0.1, 260);
    const hemisphere = new THREE.HemisphereLight('#b8c9c2', '#222a25', 2.05);
    scene.add(hemisphere);
    const moon = new THREE.DirectionalLight('#d7d8c4', 2.4);
    moon.position.set(-32, 48, 18);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -46;
    moon.shadow.camera.right = 46;
    moon.shadow.camera.top = 46;
    moon.shadow.camera.bottom = -46;
    moon.shadow.bias = -0.0003;
    scene.add(moon);

    const worldGroup = new THREE.Group();
    const mapGroup = new THREE.Group();
    const effectGroup = new THREE.Group();
    scene.add(worldGroup, effectGroup);
    worldGroup.add(mapGroup);

    const asphaltTexture = createAsphaltTexture();
    const materials = {
      grass: new THREE.MeshStandardMaterial({ color: '#526252', roughness: 1 }),
      asphalt: new THREE.MeshStandardMaterial({ color: '#d8e0dc', map: asphaltTexture, roughness: 0.94 }),
      road: new THREE.MeshStandardMaterial({ color: '#b5bfbb', map: asphaltTexture, roughness: 0.93 }),
      curb: new THREE.MeshStandardMaterial({ color: '#99988a', roughness: 0.9 }),
      line: new THREE.MeshStandardMaterial({ color: '#e4dfcb', roughness: 0.75 }),
      lane: new THREE.MeshStandardMaterial({ color: '#d1ae67', roughness: 0.75 }),
      planter: new THREE.MeshStandardMaterial({ color: '#535e50', roughness: 0.92 }),
      soil: new THREE.MeshStandardMaterial({ color: '#70624c', roughness: 1 }),
      trunk: new THREE.MeshStandardMaterial({ color: '#543c2c', roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#6d896b', roughness: 1 }),
      leafLight: new THREE.MeshStandardMaterial({ color: '#91a779', roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#727a6e', roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: '#343c39', roughness: 0.85 }),
      window: new THREE.MeshStandardMaterial({ color: '#edc779', emissive: '#bd7a32', emissiveIntensity: 0.45, roughness: 0.38 }),
      glass: new THREE.MeshStandardMaterial({ color: '#8daaaa', metalness: 0.25, roughness: 0.2 }),
      tire: new THREE.MeshStandardMaterial({ color: '#141917', roughness: 0.88 }),
      wheelFace: new THREE.MeshStandardMaterial({ color: '#9ea59c', metalness: 0.5, roughness: 0.45 }),
      black: new THREE.MeshStandardMaterial({ color: '#222927', roughness: 0.7 }),
      red: new THREE.MeshStandardMaterial({ color: '#dd685b', emissive: '#42110c', emissiveIntensity: 0.25 }),
      headlight: new THREE.MeshStandardMaterial({ color: '#f8e7b2', emissive: '#eacb83', emissiveIntensity: 1.7 }),
      neonRed: new THREE.MeshStandardMaterial({ color: '#f09581', emissive: '#ed4838', emissiveIntensity: 2.2 }),
      neonTeal: new THREE.MeshStandardMaterial({ color: '#abd6c5', emissive: '#43977e', emissiveIntensity: 1.6 })
    };

    const playerHolder = new THREE.Group();
    const playerGroup = new THREE.Group();
    const vehicleContent = new THREE.Group();
    playerGroup.add(vehicleContent);
    playerHolder.add(playerGroup);
    scene.add(playerHolder);
    const headlamps = [];
    for (const side of [-1, 1]) {
      const lamp = new THREE.SpotLight('#ffeac1', 18, 25, 0.24, 0.7, 1.2);
      lamp.position.set(side * 0.48, 0.66, 1.6);
      const target = new THREE.Object3D();
      target.position.set(side * 0.5, 0.15, 12);
      playerGroup.add(lamp, target);
      lamp.target = target;
      headlamps.push(lamp);
    }

    const trafficGroup = new THREE.Group();
    scene.add(trafficGroup);
    let trafficMeshes = [];
    let carParts = null;
    let currentModel = '';
    let currentPaint = '';
    let currentMap = '';
    let cameraReady = false;
    const cameraTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const dummy = new THREE.Object3D();
    const skidMaterial = new THREE.MeshBasicMaterial({ color: '#111514', transparent: true, opacity: 0.64, depthWrite: false });
    const skidMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.012, 1), skidMaterial, 900);
    skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    skidMesh.count = 0;
    effectGroup.add(skidMesh);
    const skidMatrix = new THREE.Matrix4();
    const skidPosition = new THREE.Vector3();
    const skidQuaternion = new THREE.Quaternion();
    const skidScale = new THREE.Vector3();
    const skidDirection = new THREE.Vector3();

    function createAsphaltTexture() {
      const textureCanvas = document.createElement('canvas');
      textureCanvas.width = 256;
      textureCanvas.height = 256;
      const context = textureCanvas.getContext('2d');
      context.fillStyle = '#303735';
      context.fillRect(0, 0, 256, 256);
      let seed = 37621;
      for (let index = 0; index < 1700; index++) {
        seed = (seed * 16807) % 2147483647;
        const x = seed % 256;
        seed = (seed * 16807) % 2147483647;
        const y = seed % 256;
        const light = seed % 2 === 0;
        context.fillStyle = light ? 'rgba(185,194,186,.08)' : 'rgba(0,0,0,.12)';
        context.fillRect(x, y, 1 + seed % 3, 1);
      }
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(15, 10);
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      return texture;
    }

    function worldX(value) { return (value - WORLD.width / 2) * SCALE; }
    function worldZ(value) { return (value - WORLD.height / 2) * SCALE; }

    function addBox(group, width, height, depth, x, y, z, material, castShadow = true) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }

    function addPlane(group, width, depth, x, y, z, material) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }

    function addMarkings(group, marks, material, height = 0.045) {
      if (!marks.length) return;
      const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.018, 1), material, marks.length);
      for (let index = 0; index < marks.length; index++) {
        const [px, py, width, depth] = marks[index];
        dummy.position.set(worldX(px), height, worldZ(py));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(width * SCALE, 1, depth * SCALE);
        dummy.updateMatrix();
        instances.setMatrixAt(index, dummy.matrix);
      }
      instances.instanceMatrix.needsUpdate = true;
      instances.receiveShadow = true;
      group.add(instances);
    }

    function addTree(group, px, py, size = 1) {
      const x = worldX(px);
      const z = worldZ(py);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * size, 0.13 * size, 0.75 * size, 7), materials.trunk);
      trunk.position.set(x, 0.39 * size, z);
      trunk.castShadow = true;
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.57 * size, 8, 7), materials.leaf);
      crown.position.set(x, 0.99 * size, z);
      crown.castShadow = true;
      group.add(crown);
      const crownLight = new THREE.Mesh(new THREE.SphereGeometry(0.34 * size, 7, 6), materials.leafLight);
      crownLight.position.set(x - 0.22 * size, 1.12 * size, z - 0.12 * size);
      crownLight.castShadow = true;
      group.add(crownLight);
    }

    function makeCarPaint(color) {
      return new THREE.MeshStandardMaterial({ color, metalness: 0.32, roughness: 0.36 });
    }

    function buildPlayerCar(model, color) {
      const group = new THREE.Group();
      const config = {
        silvia: { width: 1.72, length: 3.72, cabin: 1.86, cabinWidth: 1.36, cabinHeight: 0.66, roof: 1.17 },
        ae86: { width: 1.58, length: 3.36, cabin: 1.9, cabinWidth: 1.35, cabinHeight: 0.8, roof: 1.27 },
        rx7: { width: 1.82, length: 3.66, cabin: 1.47, cabinWidth: 1.35, cabinHeight: 0.53, roof: 1.05 }
      }[model] || { width: 1.72, length: 3.72, cabin: 1.86, cabinWidth: 1.36, cabinHeight: 0.66, roof: 1.17 };
      const paint = makeCarPaint(color);
      const accent = model === 'ae86' ? materials.black : paint;
      const body = addBox(group, config.width, 0.48, config.length, 0, 0.57, 0, paint);
      body.geometry.dispose();
      body.geometry = new THREE.BoxGeometry(config.width, 0.48, config.length);
      addBox(group, config.width * 0.96, 0.16, 0.44, 0, 0.49, config.length * 0.39, accent);
      const cabin = addBox(group, config.cabinWidth, config.cabinHeight, config.cabin, 0, config.roof, -0.1, materials.glass);
      cabin.geometry.dispose();
      cabin.geometry = new THREE.BoxGeometry(config.cabinWidth, config.cabinHeight, config.cabin);
      addBox(group, config.cabinWidth + 0.05, 0.11, config.cabin * 0.58, 0, config.roof + config.cabinHeight / 2 + 0.045, -0.12, paint);
      addBox(group, config.width * 0.92, 0.18, 0.18, 0, 0.49, -config.length * 0.49, materials.black);
      addBox(group, config.width * 0.92, 0.18, 0.18, 0, 0.49, config.length * 0.49, materials.black);
      addBox(group, config.width * 0.78, 0.09, 0.12, 0, 0.73, config.length * 0.49, materials.headlight);
      addBox(group, config.width * 0.7, 0.1, 0.12, 0, 0.73, -config.length * 0.49, materials.red);
      addBox(group, config.width + 0.12, 0.1, config.length * 0.68, 0, 0.36, 0, materials.black);

      const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12);
      const wheels = [];
      for (const side of [-1, 1]) {
        for (const axle of [-1, 1]) {
          const wheel = new THREE.Mesh(wheelGeometry, materials.tire);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side * (config.width * 0.52), 0.38, axle * config.length * 0.31);
          wheel.castShadow = true;
          group.add(wheel);
          wheels.push({ mesh: wheel, axle, side });
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 10), materials.wheelFace);
          hub.rotation.z = Math.PI / 2;
          hub.position.copy(wheel.position);
          group.add(hub);
        }
      }

      if (model === 'silvia') {
        addBox(group, 0.11, 0.23, 1.18, 0, 1.24, -config.length * 0.43, materials.black);
        addBox(group, 1.25, 0.09, 0.2, 0, 1.34, -config.length * 0.43, paint);
        for (const side of [-1, 1]) addBox(group, 0.075, 0.12, 1.05, side * (config.width * 0.52), 0.43, 0, materials.black);
      } else if (model === 'ae86') {
        for (const side of [-1, 1]) {
          addBox(group, 0.045, 0.055, config.length * 0.62, side * 0.43, 0.84, -0.08, materials.line);
        }
        addBox(group, config.cabinWidth * 0.82, 0.16, 0.16, 0, 0.71, config.length * 0.5, materials.black);
      } else {
        addBox(group, config.width * 0.4, 0.09, 0.52, 0, 0.77, config.length * 0.23, materials.black);
        addBox(group, 0.15, 0.12, 0.68, -config.width * 0.48, 0.49, 0.03, materials.black);
        addBox(group, 0.15, 0.12, 0.68, config.width * 0.48, 0.49, 0.03, materials.black);
      }

      return { group, paint, wheels, config };
    }

    function buildSimpleCar(color, length = 2.2, width = 1.2) {
      const group = new THREE.Group();
      const paint = makeCarPaint(color);
      addBox(group, width, 0.42, length, 0, 0.48, 0, paint);
      addBox(group, width * 0.73, 0.46, length * 0.46, 0, 0.87, -length * 0.04, materials.glass);
      addBox(group, width * 0.8, 0.08, 0.1, 0, 0.69, length * 0.5, materials.headlight, false);
      addBox(group, width * 0.68, 0.08, 0.1, 0, 0.69, -length * 0.5, materials.red, false);
      return group;
    }

    function addRoadsideSign(group, px, py, text, side, paletteIndex) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 80;
      const context = canvas.getContext('2d');
      const palette = ['#b64f43', '#336d64', '#686a9a', '#997242'];
      context.fillStyle = palette[paletteIndex % palette.length];
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f7e9cb';
      context.font = '700 44px "Noto Sans JP", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const signMaterial = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.34, roughness: 0.45 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.86), signMaterial);
      sign.position.set(worldX(px), 1.55, worldZ(py));
      sign.rotation.y = side;
      group.add(sign);
    }

    function buildCity() {
      const width = WORLD.width * SCALE;
      const depth = WORLD.height * SCALE;
      addPlane(mapGroup, width, depth, 0, -0.12, 0, materials.grass);
      addPlane(mapGroup, width, depth, 0, -0.04, 0, materials.concrete);
      const laneMarks = [];
      for (let x = 0; x < WORLD.width; x += 600) {
        addPlane(mapGroup, 180 * SCALE, depth, worldX(x + 90), 0.008, 0, materials.road);
        for (let y = 60; y < WORLD.height; y += 132) laneMarks.push([x + 90, y, 5, 3]);
      }
      for (let y = 0; y < WORLD.height; y += 600) {
        addPlane(mapGroup, width, 180 * SCALE, 0, 0.012, worldZ(y + 90), materials.road);
        for (let x = 60; x < WORLD.width; x += 132) laneMarks.push([x, y + 90, 3, 5]);
      }
      const crosswalkMarks = [];
      for (let x = 0; x < WORLD.width; x += 600) {
        for (let y = 0; y < WORLD.height; y += 600) {
          for (let stripe = 0; stripe < 5; stripe++) {
            const offset = 18 + stripe * 28;
            crosswalkMarks.push([x + offset, y + 31, 14, 44], [x + offset, y + 149, 14, 44]);
            crosswalkMarks.push([x + 31, y + offset, 44, 14], [x + 149, y + offset, 44, 14]);
          }
          laneMarks.push([x + 90, y + 90, 40, 5], [x + 90, y + 90, 5, 40]);
        }
      }
      addMarkings(mapGroup, laneMarks, materials.lane, 0.032);
      addMarkings(mapGroup, crosswalkMarks, materials.line, 0.038);

      const wallMats = ['#625d53', '#555d56', '#5d5a64', '#6b5d50'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      const signWords = ['ラーメン', '喫茶', '居酒屋', '寿司', '市場', '旅館'];
      let block = 0;
      for (let tileX = 0; tileX < WORLD.width; tileX += 600) {
        for (let tileY = 0; tileY < WORLD.height; tileY += 600) {
          const px = tileX + 342.5;
          const py = tileY + 342.5;
          const height = 4.2 + (block % 4) * 0.82;
          const w = 13.75;
          const d = 13.75;
          const x = worldX(px);
          const z = worldZ(py);
          addBox(mapGroup, w + 0.28, 0.34, d + 0.28, x, 0.17, z, materials.curb, false);
          addBox(mapGroup, w, height, d, x, height / 2 + 0.32, z, wallMats[block % wallMats.length]);
          addBox(mapGroup, w + 0.3, 0.2, d + 0.3, x, height + 0.48, z, materials.roof);
          addBox(mapGroup, w - 0.8, 0.12, d - 0.8, x, height + 0.63, z, materials.concrete, false);
          for (let windowIndex = 0; windowIndex < 3; windowIndex++) {
            const windowX = x - 4.4 + windowIndex * 4.4;
            addBox(mapGroup, 1.45, 0.88, 0.06, windowX, 1.3, z - d / 2 - 0.04, materials.window, false);
            addBox(mapGroup, 1.45, 0.88, 0.06, windowX, 1.3, z + d / 2 + 0.04, materials.window, false);
          }
          addRoadsideSign(mapGroup, px, py - d * 10, signWords[block % signWords.length], 0, block);
          addRoadsideSign(mapGroup, px, py + d * 10, signWords[(block + 2) % signWords.length], Math.PI, block + 1);
          if (block % 3 === 0) addTree(mapGroup, tileX + 235, tileY + 245, 0.75);
          block++;
        }
      }

      for (let x = 0; x < WORLD.width; x += 600) {
        for (let y = 0; y < WORLD.height; y += 600) {
          const lampX = worldX(x + 162);
          const lampZ = worldZ(y + 162);
          addBox(mapGroup, 0.08, 2.7, 0.08, lampX, 1.35, lampZ, materials.black, false);
          addBox(mapGroup, 0.72, 0.08, 0.18, lampX + 0.28, 2.68, lampZ, materials.headlight, false);
        }
      }
    }

    function buildParking() {
      const width = WORLD.width * SCALE;
      const depth = WORLD.height * SCALE;
      addPlane(mapGroup, width + 8, depth + 8, 0, -0.13, 0, materials.grass);
      addPlane(mapGroup, width, depth, 0, -0.02, 0, materials.asphalt);
      const marks = [];
      for (let blockX = 80; blockX < WORLD.width - 220; blockX += 440) {
        for (let blockY = 80; blockY < WORLD.height - 180; blockY += 340) {
          for (let space = 0; space < 6; space++) marks.push([blockX + space * 35, blockY + 65, 3, 106]);
          marks.push([blockX + 87, blockY + 12, 175, 3], [blockX + 87, blockY + 118, 175, 3]);
          const planterX = blockX + 190;
          const planterY = blockY + 68;
          addBox(mapGroup, 25 * SCALE, 0.42, 122 * SCALE, worldX(planterX), 0.21, worldZ(planterY), materials.planter);
          addBox(mapGroup, 20 * SCALE, 0.08, 114 * SCALE, worldX(planterX), 0.46, worldZ(planterY), materials.soil, false);
          for (let tree = 0; tree < 3; tree++) addTree(mapGroup, planterX, blockY + 28 + tree * 38, 0.78);
          if ((Math.floor(blockX / 440) + Math.floor(blockY / 340)) % 3 === 0) {
            const slot = (Math.floor(blockX / 440) + Math.floor(blockY / 340)) % 5;
            const car = buildSimpleCar(['#728c87', '#b96652', '#c5b886', '#66799a'][slot % 4], 1.8, 0.83);
            car.position.set(worldX(blockX + slot * 35 + 17), 0, worldZ(blockY + 65));
            car.rotation.y = 0;
            mapGroup.add(car);
          }
        }
      }
      addMarkings(mapGroup, marks, materials.line, 0.035);
      const fenceMarks = [];
      for (let index = 0; index < 18; index++) {
        const x = 55 + index * 205;
        fenceMarks.push([x, 40, 14, 9], [x, WORLD.height - 40, 14, 9]);
      }
      addMarkings(mapGroup, fenceMarks, materials.neonRed, 0.05);
      const boundary = new THREE.Mesh(new THREE.BoxGeometry(width - 4, 0.06, 0.1), materials.line);
      boundary.position.set(0, 0.02, worldZ(42));
      mapGroup.add(boundary);
      const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.27, 0.68, 8), new THREE.MeshStandardMaterial({ color: '#e56b48', roughness: 0.62 }), 26);
      const coneBand = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.24, 0.1, 8), materials.line, 26);
      for (let index = 0; index < 26; index++) {
        const obstacleX = 720 + index * 86;
        const obstacleY = 1320 + Math.sin(index * 0.9) * 42;
        dummy.position.set(worldX(obstacleX), 0.36, worldZ(obstacleY));
        dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); cones.setMatrixAt(index, dummy.matrix);
        dummy.position.y = 0.14; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); coneBand.setMatrixAt(index, dummy.matrix);
      }
      cones.instanceMatrix.needsUpdate = true; coneBand.instanceMatrix.needsUpdate = true;
      cones.castShadow = true; mapGroup.add(cones, coneBand);
      addBox(mapGroup, width - 4, 0.4, 0.18, 0, 0.2, worldZ(30), materials.curb, false);
      addBox(mapGroup, width - 4, 0.4, 0.18, 0, 0.2, worldZ(WORLD.height - 30), materials.curb, false);
    }

    function rebuildTraffic(vehicles) {
      for (const child of trafficGroup.children) {
        child.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material && object.material !== materials.glass && object.material !== materials.tire && object.material !== materials.headlight && object.material !== materials.red) object.material.dispose?.();
        });
      }
      trafficGroup.clear();
      trafficMeshes = vehicles.map(vehicle => {
        const group = buildSimpleCar(vehicle.color, 2.2, 1.18);
        trafficGroup.add(group);
        return group;
      });
    }

    function updateCar(state) {
      if (currentModel !== state.carModel || !carParts) {
        for (const child of [...vehicleContent.children]) {
          vehicleContent.remove(child);
          child.traverse?.(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material && object.material !== materials.glass && object.material !== materials.black && object.material !== materials.headlight && object.material !== materials.red && object.material !== materials.tire && object.material !== materials.wheelFace) object.material.dispose?.();
          });
        }
        carParts?.paint.dispose();
        carParts = buildPlayerCar(state.carModel, state.carPaint);
        currentModel = state.carModel;
        currentPaint = state.carPaint;
        vehicleContent.add(carParts.group);
      } else if (currentPaint !== state.carPaint) {
        carParts.paint.color.set(state.carPaint);
        currentPaint = state.carPaint;
      }
      const speed = Math.hypot(state.car.vx, state.car.vy);
      const forwardX = Math.cos(state.car.heading);
      const forwardZ = Math.sin(state.car.heading);
      playerHolder.position.set(worldX(state.car.x), 0, worldZ(state.car.y));
      playerHolder.rotation.y = Math.PI / 2 - state.car.heading;
      playerHolder.position.y = speed > 20 ? Math.sin(state.elapsed * 17) * 0.012 : 0;
      playerGroup.position.y = Math.min(0.1, Math.abs(state.car.angle) * 0.045);
      if (carParts) {
        for (const wheel of carParts.wheels) {
          if (wheel.axle > 0) wheel.mesh.rotation.y = -state.car.steer * 0.22;
        }
      }
      cameraTarget.set(worldX(state.car.x) + forwardX * 3.2, 0.72, worldZ(state.car.y) + forwardZ * 3.2);
      desiredCamera.set(worldX(state.car.x) - forwardX * 8.6, 5.1, worldZ(state.car.y) - forwardZ * 8.6);
      if (!cameraReady) {
        camera.position.copy(desiredCamera);
        cameraReady = true;
      } else {
        const blend = 1 - Math.exp(-Math.min(state.dt, 0.05) * 4.2);
        camera.position.lerp(desiredCamera, blend);
      }
      camera.lookAt(cameraTarget);
    }

    function updateSkids(marks) {
      const visible = marks.slice(-450);
      skidMesh.count = visible.length;
      for (let index = 0; index < visible.length; index++) {
        const mark = visible[index];
        const dx = mark.to.x - mark.from.x;
        const dz = mark.to.y - mark.from.y;
        const length = Math.hypot(dx, dz) * SCALE;
        skidPosition.set(worldX((mark.from.x + mark.to.x) / 2), 0.04, worldZ((mark.from.y + mark.to.y) / 2));
        skidDirection.set(dx, 0, dz).normalize();
        skidQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), skidDirection);
        skidScale.set(0.075, 1, Math.max(0.06, length));
        skidMatrix.compose(skidPosition, skidQuaternion, skidScale);
        skidMesh.setMatrixAt(index, skidMatrix);
        skidMesh.setColorAt(index, new THREE.Color('#181c1a').multiplyScalar(Math.max(0.28, 1 - mark.age / 38)));
      }
      skidMesh.instanceMatrix.needsUpdate = true;
      if (skidMesh.instanceColor) skidMesh.instanceColor.needsUpdate = true;
    }

    function syncTraffic(vehicles) {
      if (trafficMeshes.length !== vehicles.length) rebuildTraffic(vehicles);
      for (let index = 0; index < vehicles.length; index++) {
        const vehicle = vehicles[index];
        const mesh = trafficMeshes[index];
        mesh.position.set(worldX(vehicle.x), 0, worldZ(vehicle.y));
        mesh.rotation.y = Math.PI / 2 - vehicle.heading;
      }
      trafficGroup.visible = currentMap === 'city';
    }

    function render(state) {
      if (currentMap !== state.mapType) {
        for (const child of mapGroup.children) {
          child.traverse(object => { if (object.geometry) object.geometry.dispose(); });
        }
        mapGroup.clear();
        if (state.mapType === 'city') buildCity();
        else buildParking();
        currentMap = state.mapType;
      }
      updateCar(state);
      syncTraffic(state.traffic);
      updateSkids(state.skidMarks);
      renderer.render(scene, camera);
    }

    function resize() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    window.addEventListener('resize', resize);
    window.driftScene = { render };
    frame.classList.add('three-ready');
    resize();
    window.dispatchEvent(new Event('drift-scene-ready'));
  } catch (error) {
    console.error('3D drift scene could not start; keeping the 2D fallback.', error);
  }
}
