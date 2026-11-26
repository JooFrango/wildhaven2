import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {startVillage} from './app.mjs'

const base=new URL('../',import.meta.url)
const source=new URL('../world-visual-coherence-v12/',base)
await startVillage(THREE,OrbitControls,GLTFLoader,key=>new URL(key,base).href,key=>new URL(key,source).href)

