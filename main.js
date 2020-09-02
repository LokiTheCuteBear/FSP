let scene, camera, renderer, mesh, mixer, clock, deltaTime, clips;
let handActions;

function initialize(modelPath) {
    scene = new THREE.Scene();

    //TODO: possibly replace with a skybox for the background instead
    let backgroundColor = 0xb6c4d9;
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 10, 20);
       
    let ground = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 100, 100 ), 
        new THREE.MeshPhongMaterial({color: 0x999999, depthWrite: false})
    );
	ground.rotation.x = - Math.PI / 2;
    scene.add( ground );

    clock = new THREE.Clock();

    //Temporarily tile placeholder texture - remove when using actual diffuse
    let handDiffuse = new THREE.TextureLoader().load( '512-texture.png' );       
    handDiffuse.wrapS = THREE.RepeatWrapping;
    handDiffuse.wrapT = THREE.RepeatWrapping;
    handDiffuse.repeat.set( 120, 120 );

    //load the hand model and set up animations
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelPath,
        object => {
            mesh = object.scene;

            let standardMaterial = new THREE.MeshStandardMaterial({
                color: 0x999999, 
                depthWrite: true, 
                skinning: true, //must be set for animations to work
                map: handDiffuse
            })
            mesh.traverse(o => {if(o.isMesh) o.material = standardMaterial});
            
            mixer = new THREE.AnimationMixer(mesh);
            clips = object.animations;
           
            //make adjustments to mesh orientation and scale
            mesh.scale.set(20, 20, 20);
            mesh.position.y -= 1.5;

            scene.add(mesh); 
        }
    )

    //set up the lights - hemi and directional
    //TODO: possibly light up by the skybox if one is added
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
    directionalLight.position.set(-10, 0, 10);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    const hemiLight = new THREE.HemisphereLight(backgroundColor, 0xB97A20, 1);
    scene.add(hemiLight);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 9);
    
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    const canvas = renderer.domElement;
    canvas.setAttribute("id", "threejs-canvas");
    document.body.appendChild(canvas);
}

//TODO: pad hand sequence with 
//'abcdefghijklmnopqrstuvwxyz'
function fingerspell(word) {   
    
    word = 'mana'
    
    let idleAction = mixer.clipAction( THREE.AnimationClip.findByName( clips, 'rest' ) );
    idleAction.clampWhenFinished = true;
    idleAction.loop = THREE.LoopOnce;
    idleAction.play();
    
    //construct an array of hand actions to perform in order
    //may need an additional check for consecutive characters to add a hand-slide animation
    handActions = [];
    for (let i in word){
        let newAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i]}_hand`))    
        newAction.clampWhenFinished = true;
        newAction.loop = THREE.LoopOnce;
        handActions.push(newAction);
    }

    //construct transition action array and their directions
    let transActions = [];
    let transDirections = [];
    for(let i = 0; i < word.length-1; i++ ){
        let transAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i]}${word[i+1]}_trans`))  
      
        //if the transition action is null, then just search for it with swapped letter combo
        //this rides on the assumption that there is a valid transition present
        //this also means that the transition will have to be played back reversed
        if(transAction == null) {
            transAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, `${word[i+1]}${word[i]}_trans`));

            /*if(transAction.time === 0) {
                transAction.time = transAction.getClip().duration;
            }
            
            //transAction.paused = false;
            //transAction.setLoop(THREE.LoopOnce);      
            transAction.timeScale = -1;*/
            transDirections.push(-1)
        } else {
            transDirections.push(1);
            //transAction.time = 0;
            //transAction.timeScale = 1;
        }

        //transAction.clampWhenFinished = true;
        transAction.loop = THREE.LoopOnce;

        transActions.push(transAction);
    }

    //build directions to simplify animation and animation reversal
    actionSequence = [];
    let directions = [];
    for(let i = 0; i < handActions.length; i++){
        actionSequence.push(handActions[i]);
        directions.push(1);
        if(i < transActions.length) {
            actionSequence.push(transActions[i]);
            directions.push(transDirections[i])
        }
    }

    console.log(directions)
   
    //Recursive setup
    //activeAllActions(handActions);
    //playHandAnim(idleAction, handActions);

  
    let index = 0;
    mixer.addEventListener('finished', (e) => {
        console.log(e.action)
        e.action.stop();

        /*handActions.forEach(a => {
            a.reset().stop();
        })*/
        
        let maxIndex = actionSequence.length;
        
        if(index < maxIndex){
            let action = actionSequence[index];   
            
            if(directions[index] < 0){
                console.log('will play backwards')

                if(action.time === 0) {
                    action.time = action.getClip().duration;
                }
                
                //transAction.paused = false;
                //transAction.setLoop(THREE.LoopOnce);      
                action.timeScale = -1;
            }
            else {
                
                    action.time = 0;
                
                
                //transAction.paused = false;
                //transAction.setLoop(THREE.LoopOnce);      
                action.timeScale = 1;
            }
            /*if(action.time === 0) {
                action.time = action.getClip().duration;
            }
            
            action.paused = false;
            action.setLoop(THREE.LoopOnce);      
            action.timeScale = -1;*/

            //action.setDuration(1);
            //action.setEffectiveTimeScale = action.getEffectiveTimeScale()*0.1
            action.play();
        }
        index++;
    })
}

function playHandSequenceTransitional(){
    /*let z_action = mixer.clipAction(THREE.AnimationClip.findByName(clips, `z_hand`))    
        z_action.clampWhenFinished = true;
        z_action.loop = THREE.LoopOnce; 
        z_action.play();*/
}

function playHandAnim(idleAction, handActions){
   
    /*setWeight(handActions[0], 1);
    action = idleAction.crossFadeTo(handActions[0], 0.2, true);
    
    setTimeout(() => {
        setWeight(idleAction, 0);
        setWeight(handActions[1], 1);
        action.crossFadeTo(handActions[1], 0.2, true);
    }, 500)*/

    playHandSequence(idleAction, 0, handActions);
}

function playHandSequence(currAction, i, handActions){

    //fade to an action and hold
    //set all weight to 0 except for current and next action
    //call the same fade function

    setTimeout(() => {
        if(i >= handActions.length) return;
 
        activeAllActions(handActions); //set all weights to 0
        setWeight(currAction, 1);
        setWeight(handActions[i], 1);
        let nextAction = currAction.crossFadeTo(handActions[i], 0.2, true);
        i++;
        playHandSequence(nextAction, i, handActions);
        
    }, 500)
}

function activeAllActions(actions){
    //actions.play();
    actions.forEach((action) => {
        setWeight(action, 0);
        action.play();
    })
}

function setWeight(action, weight){
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

function animate() {
        requestAnimationFrame(animate);
        
        deltaTime = clock.getDelta();
		if (mixer) mixer.update(deltaTime);

		renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize, false);

initialize('temp_models/hand_base_transAnim.glb');
animate();