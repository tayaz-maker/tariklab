import * as T from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
export async function createViewer(stage, manifest, onPick, onProgress) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0xeef0ed, 0);
  renderer.domElement.setAttribute("aria-label", "BodyParts3D göğüs ve karın modeli");
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(38, 1, 0.01, 30),
    controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minDistance = 0.12;
  controls.maxDistance = 4;
  controls.target.set(0, 1.17, 0.11);
  scene.add(new T.HemisphereLight(0xffffff, 0x77847b, 2.5));
  for (const [p, intensity] of [
    [[1, 2, 3], 3],
    [[-2, 1, 0], 1.5],
    [[0, 2, -3], 2],
  ]) {
    const light = new T.DirectionalLight(0xfff7e9, intensity);
    light.position.set(...p);
    scene.add(light);
  }
  const meshes = [],
    materials = [],
    palette = { iskelet: 0xd7cfb3, organ: 0xad6458, kas: 0xb77e68 };
  let selected = null,
    isolated = false,
    amount = 0,
    disposed = false,
    lost = false;
  const enabled = new Set(["iskelet", "organ", "kas"]);
  const draw = () => {
    if (!disposed && !lost && document.visibilityState !== "hidden") renderer.render(scene, camera);
  };
  controls.addEventListener("change", draw);
  function visibleBox() {
    const box = new T.Box3();
    for (const mesh of meshes) if (mesh.visible) box.expandByObject(mesh);
    return box;
  }
  function fit(direction) {
    const box = visibleBox();
    if (box.isEmpty()) return;
    const size = box.getSize(new T.Vector3()),
      center = box.getCenter(new T.Vector3());
    const d =
      Math.max(size.y, size.x / camera.aspect) /
        2 /
        Math.tan(T.MathUtils.degToRad(camera.fov / 2)) +
      size.z / 2;
    const dir = direction || camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(dir, Math.max(d * 1.3, 0.18));
    camera.near = 0.005;
    camera.far = 30;
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    fit();
  }
  function update() {
    const shown = meshes.filter(
      (m) => enabled.has(m.userData.system) && (!isolated || m.userData.id === selected),
    );
    let index = 0;
    for (const m of meshes) {
      m.visible = shown.includes(m);
      const original = m.userData.center;
      const cols = camera.aspect < 0.85 ? 2 : 3,
        rows = Math.ceil(shown.length / cols);
      const slot = new T.Vector3(
        ((index % cols) - (cols - 1) / 2) * 0.36,
        1.17 + ((rows - 1) / 2 - Math.floor(index / cols)) * 0.42,
        0.11,
      );
      m.position.copy(slot.sub(original).multiplyScalar(amount));
      if (m.visible) index++;
      m.material.color.setHex(m.userData.id === selected ? 0xc38d48 : m.userData.color);
      m.material.emissive.setHex(m.userData.id === selected ? 0x211507 : 0x000000);
    }
    fit();
  }
  try {
    let loaded = 0;
    const queue = [...manifest.structures];
    async function worker() {
      while (queue.length) {
        const s = queue.shift();
        const response = await fetch(s.file);
        if (!response.ok) throw new Error("Model dosyası indirilemedi");
        const packed = await response.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", packed)),
          (v) => v.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== s.sha256 || packed.byteLength !== s.bytes)
          throw new Error("Model bütünlüğü doğrulanamadı");
        const decoded = await new Response(
          new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip")),
        ).arrayBuffer();
        if (decoded.byteLength !== s.decodedBytes) throw new Error("Model boyutu uyuşmuyor");
        const head = new DataView(decoded),
          nv = head.getUint32(0, true),
          ni = head.getUint32(4, true);
        if (
          nv !== s.vertices ||
          ni !== s.triangles * 3 ||
          8 + nv * 12 + ni * 4 !== decoded.byteLength
        )
          throw new Error("Model dizini geçersiz");
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array(decoded, 8, nv * 3), 3),
        );
        geometry.setIndex(new T.BufferAttribute(new Uint32Array(decoded, 8 + nv * 12, ni), 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const color =
          s.id === "FMA7088"
            ? 0x994b45
            : s.id.includes("720")
              ? 0x976153
              : s.id === "FMA7197"
                ? 0x8e5147
                : palette[s.system];
        const material = new T.MeshStandardMaterial({
          color,
          roughness: 0.65,
          metalness: 0,
          side: T.DoubleSide,
        });
        const mesh = new T.Mesh(geometry, material);
        mesh.userData = { ...s, color, center: geometry.boundingBox.getCenter(new T.Vector3()) };
        meshes.push(mesh);
        materials.push(material);
        scene.add(mesh);
        onProgress(++loaded, manifest.structures.length);
      }
    }
    await Promise.all([worker(), worker()]);
    meshes.sort(
      (a, b) =>
        manifest.structures.findIndex((s) => s.id === a.userData.id) -
        manifest.structures.findIndex((s) => s.id === b.userData.id),
    );
  } catch (error) {
    for (const m of meshes) m.geometry.dispose();
    materials.forEach((m) => m.dispose());
    controls.dispose();
    renderer.dispose();
    throw error;
  }
  stage.replaceChildren(renderer.domElement);
  camera.position.set(0.28, 1.25, 1.1);
  resize();
  fit(new T.Vector3(0.2, 0.06, 1).normalize());
  const observer = new ResizeObserver(() => {
    resize();
    if (amount) update();
  });
  observer.observe(stage);
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (
      !down ||
      down.id !== e.pointerId ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6
    ) {
      down = null;
      return;
    }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(
      meshes.filter((m) => m.visible),
      false,
    )[0];
    if (hit) onPick(hit.object.userData.id);
  });
  renderer.domElement.addEventListener("pointercancel", () => {
    down = null;
  });
  const key = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(e.key)) return;
    e.preventDefault();
    if (["+", "-", "="].includes(e.key)) {
      zoom(e.key === "-" ? 1.2 : 0.8);
      return;
    }
    const offset = camera.position.clone().sub(controls.target),
      s = new T.Spherical().setFromVector3(offset);
    if (e.key === "ArrowLeft") s.theta -= 0.15;
    if (e.key === "ArrowRight") s.theta += 0.15;
    if (e.key === "ArrowUp") s.phi -= 0.15;
    if (e.key === "ArrowDown") s.phi += 0.15;
    s.makeSafe();
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));
    controls.update();
    draw();
  };
  stage.addEventListener("keydown", key);
  function zoom(scale) {
    const v = camera.position.clone().sub(controls.target);
    v.multiplyScalar(scale).clampLength(0.12, 4);
    camera.position.copy(controls.target).add(v);
    controls.update();
    draw();
  }
  const visibility = () => draw();
  document.addEventListener("visibilitychange", visibility);
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    const p = document.createElement("p");
    p.className = "loading";
    p.textContent =
      "3D görüntü kesildi. Sayfayı yenileyebilir veya hafif 2D atlas bağlantısını kullanabilirsin.";
    stage.append(p);
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    lost = false;
    stage.querySelector(".loading")?.remove();
    draw();
  });
  return {
    select(id, only = isolated) {
      selected = id;
      isolated = only;
      update();
    },
    toggle(system, on) {
      on ? enabled.add(system) : enabled.delete(system);
      update();
    },
    explode(value) {
      amount = value / 100;
      update();
    },
    view(name) {
      fit(new T.Vector3(...{ front: [0, 0, 1], side: [1, 0, 0], back: [0, 0, -1] }[name]));
    },
    zoom,
    reset() {
      amount = 0;
      isolated = false;
      selected = null;
      enabled.clear();
      ["iskelet", "organ", "kas"].forEach((s) => enabled.add(s));
      update();
      fit(new T.Vector3(0.2, 0.06, 1).normalize());
    },
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        visible: meshes.filter((m) => m.visible).map((m) => m.userData.id),
        camera: camera.position.toArray(),
        positions: meshes.map((m) => m.position.toArray()),
        selected,
        isolated,
        amount,
      };
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      meshes.forEach((m) => m.geometry.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      document.removeEventListener("visibilitychange", visibility);
      stage.removeEventListener("keydown", key);
    },
  };
}
