import * as THREE from 'https://unpkg.com/three@0.120.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.120.1/examples/jsm/loaders/GLTFLoader';

import { EffectComposer } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/RenderPass.js';
import { SAOPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/SAOPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.120.1/examples/jsm/postprocessing/SMAAPass.js';
import { FilmShader } from 'https://unpkg.com/three@0.120.1/examples/jsm/shaders/FilmShader.js';

let scene, camera, renderer, composer;
let backgroundScene, backgroundCamera, backgroundRenderer, backgroundComposer;
let idleAction, mesh, mixer, clock, deltaTime, clips;

let isPlaying = false;
let useHighQuality = true;
let speedCoffs = [.5, 1, 2, 3];
let speed = speedCoffs[1];

function setQuality(newQuality) { useHighQuality = newQuality; }
function setAnimSpeed(newSpeed) { speed = speedCoffs[newSpeed]; }
function setHandAngle(newAngle) { mesh.rotation.y = THREE.MathUtils.degToRad(newAngle); }

async function init(modelPath) {
    let dimensions = recalculateDimensions();
    let width = dimensions.width;
    let height = dimensions.height;

    clock = new THREE.Clock();

    backgroundScene = new THREE.Scene();

    backgroundCamera = new THREE.PerspectiveCamera(45, document.body.clientWidth / document.body.clientHeight, 1, 10);

    backgroundRenderer = new THREE.WebGLRenderer({ antialias: true });
    backgroundRenderer.setPixelRatio(window.devicePixelRatio);
    backgroundRenderer.setSize(document.body.clientWidth, document.body.clientHeight);

    const backgroundCanvas = backgroundRenderer.domElement;
    backgroundCanvas.setAttribute("class", "threejs-canvas");
    document.body.appendChild(backgroundCanvas);

    addGradientBackground();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, width / height, 1, 20);
    camera.position.set(0, .7, 10);

    try {
        await addHandModel(modelPath);
    } catch (err) {
        return err;
    }

    addLights();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.setAttribute("class", "threejs-canvas");
    document.body.appendChild(canvas);
    window.sceneLoaded = true;

    addEffects();
}

function addLights() {
    let directionalLight = new THREE.DirectionalLight(0xFFFFFF, .5);
    directionalLight.position.set(10, 0, 10);
    scene.add(directionalLight);

    let hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xc4a880, 1);
    scene.add(hemiLight);

    let AmbientLight = new THREE.AmbientLight(0x404040, .7);
    scene.add(AmbientLight);
}

function addEffects() {
    composer = new EffectComposer(renderer);

    let renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    let saoPass = new SAOPass(scene, camera, false, true);
    saoPass.depthMaterial.skinning = true;
    saoPass.depthMaterial.morphTargets = true;
    saoPass.normalMaterial.skinning = true;
    saoPass.normalMaterial.morphTargets = true;
    saoPass.params.saoScale = 2;
    saoPass.params.saoBias = 0.5;
    saoPass.params.saoIntensity = 0.07;
    saoPass.params.saoKernelRadius = 16;
    saoPass.params.output = SAOPass.OUTPUT.Default;
    composer.addPass(saoPass);

    let smaaPass = new SMAAPass(document.body.clientWidth * renderer.getPixelRatio(), document.body.clientHeight * renderer.getPixelRatio());
    composer.addPass(smaaPass);
}

function addGradientBackground() {
    let backgroundCanvas = document.createElement("canvas");
    backgroundCanvas.width = document.body.clientWidth;
    backgroundCanvas.height = document.body.clientHeight;

    let context = backgroundCanvas.getContext("2d");

    let gradient = context.createRadialGradient(
        document.body.clientWidth / 2,
        document.body.clientHeight / 2,
        document.body.clientWidth / 6, // inner radius
        document.body.clientWidth / 2,
        document.body.clientHeight / 2,
        document.body.clientHeight      // outer radius
    );

    gradient.addColorStop(0, "#4f4f4f");
    gradient.addColorStop(1, "#303030");

    context.fillStyle = gradient;
    context.fillRect(0, 0, document.body.clientWidth, document.body.clientHeight);

    let backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    backgroundScene.background = backgroundTexture;

    // add background post to create some noise
    backgroundComposer = new EffectComposer(backgroundRenderer);

    let renderPass = new RenderPass(backgroundScene, backgroundCamera);
    backgroundComposer.addPass(renderPass);

    let filmPass = new ShaderPass(FilmShader);
    filmPass.uniforms['nIntensity'].value = 0.2;
    backgroundComposer.addPass(filmPass);
}

function addHandModel(path) {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        let handDiffuse = textureLoader.load('textures/diffuse.jpg', texture => texture.flipY = false, undefined, error => { reject(error) });
        let handNormals = textureLoader.load('textures/normals_inverse_1k.png', texture => texture.flipY = false, undefined, error => { reject(error) });
        let handSpecular = textureLoader.load('textures/roughness.jpg', texture => texture.flipY = false, undefined, error => { reject(error) });

        // load the hand model and set up animations
        const loader = new GLTFLoader();
        loader.load(
            path,
            object => {
                mesh = object.scene;

                let standardMaterial = new THREE.MeshStandardMaterial({
                    depthWrite: true,
                    skinning: true,
                    morphTargets: true,
                    map: handDiffuse,
                    normalMap: handNormals,
                    roughnessMap: handSpecular
                })
                mesh.traverse(o => { if (o.isMesh) o.material = standardMaterial });

                mixer = new THREE.AnimationMixer(mesh);
                clips = object.animations;

                //no clips except for idle will loop, hence set looping on load
                clips.forEach(clip => {
                    let action = mixer.clipAction(clip);
                    action.loop = THREE.LoopOnce;
                })

                //start playing the idle animation from start
                idleAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'idle_loop'));
                idleAction.loop = THREE.loop;
                idleAction.play();

                mesh.position.y -= 1.35;
                mesh.position.z = 1.5;

                scene.add(mesh);

                resolve();
            },
            xhr => { },
            error => { reject(error); }
        );
    });
}

function pushAction(sequence, actionName, timeScale, slide, slideDirection, addToStart) {
    let action = mixer.clipAction(THREE.AnimationClip.findByName(clips, actionName));
    if (action) {
        if (!addToStart) {
            sequence.push({
                action: action,
                timeScale: timeScale,
                slide: slide,
                slideDirection: slideDirection
            });
        } else {
            sequence.unshift({
                action: action,
                timeScale: timeScale,
                slide: slide,
                slideDirection: slideDirection
            });
        }
    }
}

function buildAnimSequence(word) {
    let actionSequence = [];
    let lastActionAnOffset = false;

    for (let i = 0; i < word.length; i++) {
        if (i == 0) { // first letter will always just be 'letter'_hand action
            pushAction(actionSequence, `${word[i]}_hand`, 1, false, 1, false);
        } else {
            let nextLetterSame = i + 1 < word.length ? word[i] == word[i + 1] : false;

            // add transition to new letter    
            // J and Z need special handling since their end pose is different to start
            // we're pushing an action twice expecting only one to be pushed - this rides on assumptions on what animations are present
            if (word[i] != 'j' && word[i] != 'z' && word[i - 1] != 'j' && word[i - 1] != 'z') {
                pushAction(actionSequence, `${word[i]}_${word[i - 1]}_trans`, -1, lastActionAnOffset, -1, false);
                pushAction(actionSequence, `${word[i - 1]}_${word[i]}_trans`, 1, lastActionAnOffset, -1, false);
            } else {
                if (word[i] != word[i - 1]) {
                    pushAction(actionSequence, `${word[i - 1]}_${word[i]}_trans`, 1, lastActionAnOffset, -1, false);
                }
            }

            // add smol buffer before sliding
            if (word[i] != 'j' && word[i] != 'z') {
                // add a smol buffer after transition back to hold the pose
                if (lastActionAnOffset) {
                    pushAction(actionSequence, `${word[i]}_hand`, 2, false, 1, false);
                }

                if (word[i - 1] != 'j' && word[i - 1] != 'z') pushAction(actionSequence, `${word[i]}_hand`, 2, false, 1, false);
                pushAction(actionSequence, `${word[i]}_hand`, 1, nextLetterSame, 1, false);
            } else {
                pushAction(actionSequence, `${word[i]}_hand`, 1, false, 1, false);
                if (nextLetterSame) pushAction(actionSequence, `${word[i]}_${word[i]}_trans`, 1, nextLetterSame, 1, false);
            }

            lastActionAnOffset = false;
            if (word[i] == word[i - 1]) lastActionAnOffset = true;
        }
    }

    //pad the front and end of the sequence with rest pose transitions
    if (word[0] != 'j' && word[0] != 'z') {
        pushAction(actionSequence, `rest_${word[0]}_trans`, 1, false, 1, true);
        pushAction(actionSequence, `${word[0]}_rest_trans`, -1, false, 1, true);
    } else {
        pushAction(actionSequence, `rest_${word[0]}_trans`, 1, false, 1, true);
    }

    let lastTwoLettersSame = word[word.length - 1] == word[word.length - 2];

    if (word[word.length - 1] != 'j' && word[word.length - 1] != 'z') {
        pushAction(actionSequence, `${word[word.length - 1]}_rest_trans`, 1, lastTwoLettersSame, -1, false);
        pushAction(actionSequence, `rest_${word[word.length - 1]}_trans`, -1, lastTwoLettersSame, -1, false);
    } else {
        pushAction(actionSequence, `${word[word.length - 1]}_rest_trans`, 1, lastTwoLettersSame, -1, false);
    }

    return actionSequence;
}

function fingerspell(word, onFinishCallback) {
    // console.log(word)
    let actionSequence = buildAnimSequence(word);
    // console.log(actionSequence)

    isPlaying = true;
    mixer.timeScale = speed;

    //smoothly transition from the idle animation into the first transition
    let action = actionSequence[0].action;
    action.time = action.getClip().duration * (actionSequence[0].timeScale < 0);
    action.timeScale = actionSequence[0].timeScale;
    action.play().crossFadeFrom(idleAction, action.getClip().duration / 2, false);

    //add an event listener to play the next sequence animation after one completes
    let index = 0;
    mixer.addEventListener('finished', (e) => {
        // ignore additive slide finish
        if (e.action._clip.name == 'slide') return;

        e.action.stop();
        index++;

        if (index < actionSequence.length) {
            let action = actionSequence[index].action;

            //change animation direction to accomodate inverted transitions
            action.time = action.getClip().duration * (actionSequence[index].timeScale < 0);
            action.timeScale = actionSequence[index].timeScale;

            let clip = THREE.AnimationClip.findByName(clips, 'slide');
            THREE.AnimationUtils.makeClipAdditive(clip);
            let slideAction = mixer.clipAction(clip);

            slideAction.loop = THREE.LoopOnce;
            slideAction.clampWhenFinished = true;
            slideAction.timeScale = actionSequence[index].slideDirection;

            if (actionSequence[index].slide) {
                slideAction.reset();
                if (actionSequence[index].slideDirection == -1) slideAction.time = slideAction.getClip().duration;
                slideAction.play();
            }

            action.play();
        }

        //transition back into the idle animation from the last transition
        if (index == actionSequence.length) {
            mixer.timeScale = 1;
            idleAction.enabled = true;
            idleAction.paused = false;
            idleAction.time = 0;
            isPlaying = false;
            onFinishCallback();
        }
    });
}

function animate() {
    requestAnimationFrame(animate);

    deltaTime = clock.getDelta();
    if (mixer) mixer.update(deltaTime);

    if (useHighQuality) {
        backgroundComposer.render();
        composer.render();
    } else {
        if (backgroundRenderer) backgroundRenderer.render(backgroundScene, backgroundCamera);
        renderer.render(scene, camera);
    }
}

function handleWindowResize() {
    let dimensions = recalculateDimensions();
    let width = dimensions.width;
    let height = dimensions.height;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    backgroundCamera.aspect = document.body.clientWidth, document.body.clientHeight;
    backgroundCamera.updateProjectionMatrix();

    backgroundRenderer.setSize(document.body.clientWidth, document.body.clientHeight);
    renderer.setSize(width, height);

    backgroundComposer.setSize(document.body.clientWidth, document.body.clientHeight);
    composer.setSize(width, height);
}

// preserve aspect ratio for mobile/vertical displays so the hand would always have room for slide animations
function recalculateDimensions() {
    let lowerAspect = 1.07;
    let height = document.getElementById("ui-container").offsetTop + document.getElementById("ui-container").clientHeight;
    return {
        width: document.body.clientWidth,
        height: document.body.clientWidth / height <= lowerAspect ? (document.body.clientWidth / lowerAspect) * 0.8 : height
    };
}

window.addEventListener('resize', handleWindowResize, false);

export { init, animate, fingerspell, setHandAngle, setAnimSpeed, setQuality, handleWindowResize };