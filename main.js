let scene, camera, renderer, mesh, mixer, clock, deltaTime, clips;
let animTimeScales, actionSequence;

import * as THREE from 'https://unpkg.com/three@0.120.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.120.1/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'https://unpkg.com/three@0.120.1/examples/jsm/controls/OrbitControls.js';

//let composer;
/*import { EffectComposer } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/SSAOPass.js';
import { SAOPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/SAOPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/ShaderPass.js';*/

function initialize(modelPath) {
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 3, 10);
    camera.position.set(0, 1, 9);

    scene = new THREE.Scene();
    
    addGradientBackground();
    addHandModel(modelPath);
    addLights();

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const canvas = renderer.domElement;
    canvas.setAttribute("id", "threejs-canvas");
    document.body.appendChild(canvas);
    
    //var controls = new OrbitControls( camera, renderer.domElement )
}

//TEMP: breaks the effects with skinned meshes when multiple are used or a canvas is added
function addPostEffects(){
    /*composer = new EffectComposer(renderer);

    let renderPass = new RenderPass( scene, camera );
    composer.addPass( renderPass );

    let saoPass = new SAOPass( scene, camera, false, true);

    saoPass.depthMaterial.skinning = true;
    saoPass.depthMaterial.morphTargets = true;
    saoPass.normalMaterial.skinning = true;
    saoPass.normalMaterial.morphTargets = true;
   
    saoPass.params.saoScale = 4
    saoPass.params.saoBias = 0
    saoPass.params.saoIntensity = 0.2
    saoPass.params.saoKernelRadius = 100

    saoPass.params.output = SAOPass.OUTPUT.Normal
    //saoPass.saoIntensity = 0
    composer.addPass( saoPass );*/
}

function addHandModel(modelPath){
    //Temporarily tile placeholder texture - remove when using actual diffuse
    let handDiffuse = new THREE.TextureLoader().load( '512-texture.png' );       
    handDiffuse.wrapS = THREE.RepeatWrapping;
    handDiffuse.wrapT = THREE.RepeatWrapping;
    handDiffuse.repeat.set( 1, 1 );

    //load the hand model and set up animations
    const loader = new GLTFLoader();
    loader.load(
        modelPath,
        object => {
            mesh = object.scene;

            let standardMaterial = new THREE.MeshStandardMaterial({
                color: 0xecbcb4, 
                depthWrite: true, 
                skinning: true,
                morphTargets: true//,
                //map: handDiffuse
            })
            mesh.traverse(o => {if(o.isMesh) o.material = standardMaterial});
            
            mixer = new THREE.AnimationMixer(mesh);
            clips = object.animations;

            //no clips will loop, hence set looping on load
            clips.forEach(clip => {
                let action = mixer.clipAction(clip);
                action.loop = THREE.LoopOnce;
            })

            //make adjustments to mesh orientation and scale
            mesh.scale.set(20, 20, 20);
            mesh.position.y -= 1.5;
            mesh.position.z = 1.5;

            scene.add(mesh); 
        }
    )
}

function addLights(){ 
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0);
    directionalLight.position.set(-10, 0, 10);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xB97A20, 1);
    scene.add(hemiLight);
}

function addGradientBackground() {
    let backgroundCanvas = document.createElement("canvas");
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;

    let ctx = backgroundCanvas.getContext("2d");

    let gradient = ctx.createRadialGradient(
        window.innerWidth  / 2, 
        window.innerHeight / 2, 
        window.innerWidth  / 6, //inner radius
        window.innerWidth  / 2, 
        window.innerHeight / 2,  
        window.innerHeight      //outer radius
    );
    
    gradient.addColorStop(0, "#4f4f4f");
    gradient.addColorStop(1, "#303030");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    //add slight variance to make the gradient noisy
    //could be handled by the shader instead
    let imageData = ctx.getImageData(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    let data = imageData.data;

    for (var i = 0; i < data.length; i += 4) {
        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        let variance = avg * Math.random() * 0.15;
        data[i]     += variance; // red
        data[i + 1] += variance; // green
        data[i + 2] += variance; // blue
    }

    ctx.putImageData(imageData, 0, 0);
    
    let backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    scene.background = backgroundTexture;
}

//play the rest pose to trigger the first finished anim event to start the anim sequence
function instantlyFinishIdleAnim(){    
    let idleAction = mixer.clipAction( THREE.AnimationClip.findByName( clips, 'rest' ) );
    idleAction.time = idleAction.getClip().duration; //set to end of clip to instantly trigger 'finished' event
    idleAction.play();
}

function buildAnimSequence(word){
    let handActions = [];
    let transActions = [];
    let transDirections = [];
    
    //construct an array of hand actions to perform in order
    for (let i in word){
        handActions.push( mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i]}_hand`)) );
    }

    //construct transition action array and their directions
    //TODO: if letters are matching then the transition should be replaced with a slide anim
    for(let i = 0; i < word.length-1; i++ ){
        let transAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i]}${word[i+1]}_trans`))  
      
        //if the transition action is null, then just search for it with swapped letter combo
        //this rides on the assumption that there is a valid transition present
        //this also means that the transition will have to be played back reversed
        if(transAction == null) {
            transAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i+1]}${word[i]}_trans`));
            transDirections.push(-1)
        } else {
            transDirections.push(1);
        }

        transActions.push(transAction);
    }

    //build animTimeScales to simplify animation and animation reversal
    actionSequence = [];
    animTimeScales = [];
    for(let i = 0; i < handActions.length; i++){
        actionSequence.push(handActions[i]);
        animTimeScales.push(1);

        if(i < transActions.length) {
            actionSequence.push(transActions[i]);
            animTimeScales.push(transDirections[i])
        }
    }

    //pad the front of the sequence with transition from rest pose to the first letter
    let startAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `rest_${word[0]}_trans`));  
    actionSequence = [startAction].concat(actionSequence)
    animTimeScales = [1].concat(animTimeScales)

    //pad the end of the sequence with transition from last letter to rest - same inverted transition concept
    let endAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `rest_${word[word.length-1]}_trans`));
    actionSequence.push(endAction)
    animTimeScales.push(-1)
}

//'abcdefghijklmnopqrstuvwxyz'
function fingerspell(word) {   
    word = 'ana';//TEMP - overriding the input word while animations not ready on the hand asset

    instantlyFinishIdleAnim();
    buildAnimSequence(word);

    let index = 0;
    mixer.addEventListener('finished', (e) => {
        e.action.stop();

        if(index < actionSequence.length){
            let action = actionSequence[index];   
            
            //change animation direction to accomodate inverted transitions
            action.time = action.getClip().duration * (animTimeScales[index] < 0); 
            action.timeScale = animTimeScales[index]; 
            
            action.play();
        }

        index++;
    });
}

function animate() {
        requestAnimationFrame(animate);
        
        deltaTime = clock.getDelta();
		if (mixer) mixer.update(deltaTime);

        renderer.render( scene, camera );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    //fairly slow to update - stretched noise looks really bad
    //TODO: potentially add performance controls to the user to cancel certain effects
    addGradientBackground()
}

//handle the playback speed - values may be extended for further use to finetune transition vs 'hold' speed
//TODO: speed requires qualified revision
const setAnimSpeed = (newSpeed) => mixer.timeScale = newSpeed;

//handle rotating the hand
//TODO: extend to snap to 90 degree increments
const setAnimAngle = (newAngle) => mesh.rotation.y = newAngle * (Math.PI/180);

window.addEventListener('resize', onWindowResize, false);
window.setAnimAngle = setAnimAngle;
window.setAnimSpeed = setAnimSpeed;
window.fingerspell = fingerspell;

//TODO: initialization should be handled by the UI controler script to update the UI with loading status initially
initialize('temp_models/hand_base_transAnim.glb');
animate();

