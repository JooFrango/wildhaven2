export function startVillage(
    three: typeof import('three'),
    controls: typeof import('three/addons/controls/OrbitControls.js').OrbitControls,
    loader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader,
    assetUrl: (key:string)=>string,
    worldUrl: (key:string)=>string
): Promise<void>

