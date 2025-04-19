// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Colors
const SKY_BLUE = 0x87CEEB;
const GROUND_COLOR = 0x32CD32;
const TREE_COLOR = 0x006400;
const HOUSE_COLOR = 0xCD853F;

// Number of villagers to spawn
const NUMBER_OF_VILLAGERS = 10;

// Game state
let score = 0;
let gameOver = false;
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const restartButton = document.getElementById('restart-button');
const pewPewElement = document.getElementById('pew-pew');

// Player settings
const player = {
    position: new THREE.Vector3(0, 0, 0),
    speed: 0.1,
    rotation: {
        x: 0,
        y: 0
    }
};

// Create ground
const groundGeometry = new THREE.PlaneGeometry(40, 40);
const groundMaterial = new THREE.MeshBasicMaterial({ color: GROUND_COLOR, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
ground.position.y = -1;
scene.add(ground);

// Create sky
const skyGeometry = new THREE.BoxGeometry(100, 100, 100);
const skyMaterial = new THREE.MeshBasicMaterial({ color: SKY_BLUE, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Create trees
const trees = [];
for (let i = 0; i < 20; i++) {
    const tree = createTree(
        Math.random() * 20 - 10,
        0,
        Math.random() * 20 - 10
    );
    trees.push(tree);
    scene.add(tree);
}

// Create houses
const houses = [];
for (let i = 0; i < 5; i++) {
    const house = createHouse(
        Math.random() * 20 - 10,
        0,
        Math.random() * 20 - 10
    );
    houses.push(house);
    scene.add(house);
}

// Villager class
class Villager {
    constructor(x, z) {
        this.mesh = this.createMesh();
        this.mesh.position.set(x, 0, z);
        this.health = 100;
        this.speed = 0.02;
        this.direction = new THREE.Vector3(
            Math.random() * 2 - 1,
            0,
            Math.random() * 2 - 1
        ).normalize();
        this.changeDirectionTime = 0;
        this.isDead = false;
        this.bloodPool = null;
    }

    createMesh() {
        const group = new THREE.Group();

        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const headMaterial = new THREE.MeshBasicMaterial({ color: 0xFFE4B5 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.3;
        group.add(head);

        // Face
        const faceGroup = new THREE.Group();
        faceGroup.position.y = 0;

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.1, 0.3);
        faceGroup.add(leftEye);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.1, 0.3);
        faceGroup.add(rightEye);

        // Mouth
        const mouthGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.05);
        const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.1, 0.3);
        faceGroup.add(mouth);

        // Add face to head
        head.add(faceGroup);

        return group;
    }

    update(deltaTime) {
        if (this.isDead) {
            // Keep blood pool with dead villager
            if (this.bloodPool) {
                this.bloodPool.position.set(
                    this.mesh.position.x,
                    0.01,
                    this.mesh.position.z
                );
            }
            return;
        }

        // Change direction randomly
        this.changeDirectionTime -= deltaTime;
        if (this.changeDirectionTime <= 0) {
            this.direction = new THREE.Vector3(
                Math.random() * 2 - 1,
                0,
                Math.random() * 2 - 1
            ).normalize();
            this.changeDirectionTime = Math.random() * 2000 + 1000; // 1-3 seconds
        }

        // Move villager
        const newPosition = this.mesh.position.clone();
        newPosition.x += this.direction.x * this.speed;
        newPosition.z += this.direction.z * this.speed;

        // Keep within bounds
        if (Math.abs(newPosition.x) < 19 && Math.abs(newPosition.z) < 19) {
            this.mesh.position.copy(newPosition);
        } else {
            // If out of bounds, change direction
            this.changeDirectionTime = 0;
        }

        // Rotate to face movement direction
        this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        } else {
            // Flash red when hit
            this.mesh.children.forEach(child => {
                const originalColor = child.material.color.getHex();
                child.material.color.set(0xFF0000);
                setTimeout(() => {
                    child.material.color.set(originalColor);
                }, 100);
            });
        }
    }

    die() {
        this.isDead = true;
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.y = 0.1;
        // Calculate head position in local space (head is at y=1.3)
        const headLocal = new THREE.Vector3(0, 1.3, 0);
        // Transform head position to world space after rotation
        const headWorld = headLocal.clone().applyEuler(this.mesh.rotation).add(this.mesh.position);
        // Project to ground
        headWorld.y = 0.01;
        // Place blood pool at head
        const bloodGeometry = new THREE.CircleGeometry(0.5, 16);
        const bloodMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000, // Brighter red
            transparent: true,
            opacity: 0.9
        });
        const bloodPool = new THREE.Mesh(bloodGeometry, bloodMaterial);
        bloodPool.rotation.x = -Math.PI / 2;
        bloodPool.position.copy(headWorld);
        scene.add(bloodPool);
        this.bloodPool = bloodPool;
        score += 100;
        scoreElement.textContent = `Score: ${score}`;
        
        // Check if all villagers are dead
        checkGameOver();
    }
}

// Function to check if all villagers are dead
function checkGameOver() {
    if (gameOver) return; // Already checked
    
    const allDead = villagers.every(villager => villager.isDead);
    
    if (allDead) {
        gameOver = true;
        // Show game over message
        gameOverElement.style.display = 'block';
        // Exit pointer lock
        document.exitPointerLock();
        // Disable controls
        isPointerLocked = false;
    }
}

// Create villagers
const villagers = [];
for (let i = 0; i < NUMBER_OF_VILLAGERS; i++) {
    const villager = new Villager(
        Math.random() * 20 - 10,
        Math.random() * 20 - 10
    );
    villagers.push(villager);
    scene.add(villager.mesh);
}

// Helper functions
function createTree(x, y, z) {
    const treeGroup = new THREE.Group();

    // Tree trunk
    const trunkGeometry = new THREE.BoxGeometry(0.2, 2, 0.2);
    const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    treeGroup.add(trunk);

    // Tree top
    const topGeometry = new THREE.ConeGeometry(1, 2, 8);
    const topMaterial = new THREE.MeshBasicMaterial({ color: TREE_COLOR });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 2.5;
    treeGroup.add(top);

    treeGroup.position.set(x, y, z);
    return treeGroup;
}

function createHouse(x, y, z) {
    const houseGroup = new THREE.Group();

    // House base
    const baseGeometry = new THREE.BoxGeometry(2, 1.5, 2);
    const baseMaterial = new THREE.MeshBasicMaterial({ color: HOUSE_COLOR });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.75;
    houseGroup.add(base);

    // Roof
    const roofGeometry = new THREE.ConeGeometry(2.5, 1.5, 4);
    const roofMaterial = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 2.25;
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(roof);

    houseGroup.position.set(x, y, z);
    return houseGroup;
}

// Set initial camera position
camera.position.z = 5;

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle keyboard input
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Mouse/trackpad look controls
let isPointerLocked = false;
const mouseSensitivity = 0.003;
let euler = new THREE.Euler(0, 0, 0, 'YXZ'); // YXZ order ensures no tilting

// Handle pointer lock change
document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    if (!isPointerLocked && !gameOver) {
        // If pointer lock is lost and game isn't over, request it again
        renderer.domElement.requestPointerLock();
    }
});

// Request pointer lock on click
renderer.domElement.addEventListener('click', () => {
    if (!gameOver) {
        renderer.domElement.requestPointerLock();
    }
});

// Handle mouse/trackpad movement
document.addEventListener('mousemove', (event) => {
    if (!isPointerLocked) return;

    // Update euler angles
    euler.y -= event.movementX * mouseSensitivity; // Left/Right
    euler.x -= event.movementY * mouseSensitivity; // Up/Down

    // Limit vertical rotation
    euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x));
    
    // Keep camera level by enforcing zero roll
    euler.z = 0;

    // Apply euler angles to camera
    camera.quaternion.setFromEuler(euler);
    
    // Sync player rotation for movement
    player.rotation.y = euler.y;
});

// Shooting mechanics
const bullets = [];
const bulletSpeed = 0.5;
const maxBulletDistance = 200;

function createBullet() {
    // Create a more visible bullet
    const bulletGroup = new THREE.Group();
    
    // Main bullet
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFF00,
        transparent: true,
        opacity: 0.8
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletGroup.add(bullet);
    
    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFA500,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    bulletGroup.add(glow);
    
    // Set position and direction
    bulletGroup.position.copy(camera.position);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    bulletGroup.userData.direction = direction;
    bulletGroup.userData.distance = 0;
    bulletGroup.userData.speed = bulletSpeed;
    
    scene.add(bulletGroup);
    bullets.push(bulletGroup);
    
    // Show pew-pew text
    pewPewElement.style.opacity = '1';
    setTimeout(() => {
        pewPewElement.style.opacity = '0';
    }, 200);
    
    // Add muzzle flash effect
    const flashGeometry = new THREE.SphereGeometry(0.4, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF0000,
        transparent: true,
        opacity: 0.8
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(bulletGroup.position);
    scene.add(flash);
    
    // Animate flash
    let flashSize = 0.4;
    const flashInterval = setInterval(() => {
        flashSize -= 0.1;
        if (flashSize <= 0) {
            clearInterval(flashInterval);
            scene.remove(flash);
        } else {
            flash.scale.set(flashSize, flashSize, flashSize);
        }
    }, 50);
}

// --- SHOOTING WITH LEFT CLICK ---
let canShoot = true;
const shootCooldown = 500;
renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && canShoot && isPointerLocked && !gameOver) { // Left click
        createBullet();
        canShoot = false;
        setTimeout(() => { canShoot = true; }, shootCooldown);
    }
});

// Helper function for AABB collision
function aabbCollision(pos, size, targetPos, targetSize) {
    return (
        Math.abs(pos.x - targetPos.x) < (size.x / 2 + targetSize.x / 2) &&
        Math.abs(pos.z - targetPos.z) < (size.z / 2 + targetSize.z / 2)
    );
}

// House and tree bounding box sizes
const HOUSE_SIZE = new THREE.Vector3(2, 1.5, 2);
const TREE_SIZE = new THREE.Vector3(1, 2.5, 1);
const PLAYER_SIZE = new THREE.Vector3(0.5, 1.5, 0.5);
const VILLAGER_SIZE = new THREE.Vector3(0.6, 1.6, 0.6);

// Check if a position collides with any house (not trees)
function collidesWithObstacle(pos, size) {
    for (const house of houses) {
        if (aabbCollision(pos, size, house.position, HOUSE_SIZE)) return true;
    }
    return false;
}

// Update villagers
villagers.forEach(villager => {
    villager.update = function(deltaTime) {
        if (this.isDead) {
            if (this.bloodPool) {
                this.bloodPool.position.set(
                    this.mesh.position.x,
                    0.01,
                    this.mesh.position.z
                );
            }
            return;
        }
        this.changeDirectionTime -= deltaTime;
        if (this.changeDirectionTime <= 0) {
            this.direction = new THREE.Vector3(
                Math.random() * 2 - 1,
                0,
                Math.random() * 2 - 1
            ).normalize();
            this.changeDirectionTime = Math.random() * 2000 + 1000;
        }
        // Try to move
        const newPosition = this.mesh.position.clone();
        newPosition.x += this.direction.x * this.speed;
        newPosition.z += this.direction.z * this.speed;
        if (
            Math.abs(newPosition.x) < 19 &&
            Math.abs(newPosition.z) < 19 &&
            !collidesWithObstacle(newPosition, VILLAGER_SIZE)
        ) {
            this.mesh.position.copy(newPosition);
        } else {
            this.changeDirectionTime = 0;
        }
        this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    }
});

// Update player movement to prevent walking through houses/trees
function tryMovePlayer(moveDirection) {
    const newPosition = player.position.clone().add(moveDirection);
    if (!collidesWithObstacle(newPosition, PLAYER_SIZE)) {
        player.position.copy(newPosition);
    }
}

// Check for bullet collisions
function checkCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const bulletPosition = bullet.position.clone();
        // Check collision with villagers
        for (const villager of villagers) {
            if (villager.isDead) continue;
            const villagerPosition = villager.mesh.position.clone();
            const distance = bulletPosition.distanceTo(villagerPosition);
            if (distance < 1.0) {
                // Check if it's a headshot
                const headPosition = new THREE.Vector3(
                    villagerPosition.x,
                    villagerPosition.y + 1.3,
                    villagerPosition.z
                );
                const headDistance = bulletPosition.distanceTo(headPosition);
                if (headDistance < 0.5) {
                    villager.die(); // Instant kill
                    score += 200;
                    scoreElement.textContent = `Score: ${score}`;
                } else {
                    villager.takeDamage(50);
                }
                scene.remove(bullet);
                bullets.splice(i, 1);
                break;
            }
        }
        // Check collision with houses
        let hitObstacle = false;
        for (const house of houses) {
            if (aabbCollision(bulletPosition, new THREE.Vector3(0.3,0.3,0.3), house.position, HOUSE_SIZE)) {
                hitObstacle = true;
                break;
            }
        }
        // Check collision with trees
        if (!hitObstacle) {
            for (const tree of trees) {
                if (aabbCollision(bulletPosition, new THREE.Vector3(0.3,0.3,0.3), tree.position, TREE_SIZE)) {
                    hitObstacle = true;
                    break;
                }
            }
        }
        if (hitObstacle) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
        // Check if bullet is out of bounds
        if (Math.abs(bullet.position.x) > 20 || Math.abs(bullet.position.z) > 20) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }
}

// Animation loop
let lastTime = performance.now();
function animate() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    requestAnimationFrame(animate);
    
    if (isPointerLocked && !gameOver) {
        const moveDirection = new THREE.Vector3();
        const moveSpeed = player.speed;
        if (keys['w']) moveDirection.z -= moveSpeed;
        if (keys['s']) moveDirection.z += moveSpeed;
        if (keys['a']) moveDirection.x -= moveSpeed;
        if (keys['d']) moveDirection.x += moveSpeed;
        moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
        tryMovePlayer(moveDirection);
        camera.position.copy(player.position);
        camera.position.y = 1.5;
    }
    
    // Update bullets with smooth movement
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const moveAmount = bullet.userData.speed * (deltaTime / 16.67); // Normalize speed
        const direction = bullet.userData.direction.clone(); // Create a new direction vector
        bullet.position.add(direction.multiplyScalar(moveAmount));
        bullet.userData.distance += moveAmount;
        
        // Fade out bullets as they travel
        const fadeDistance = maxBulletDistance * 0.7;
        if (bullet.userData.distance > fadeDistance) {
            const fadeAmount = (bullet.userData.distance - fadeDistance) / (maxBulletDistance - fadeDistance);
            bullet.children.forEach(child => {
                if (child.material.opacity !== undefined) {
                    child.material.opacity = 1 - fadeAmount;
                }
            });
        }
        
        if (bullet.userData.distance > maxBulletDistance) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }

    // Update villagers
    villagers.forEach(villager => villager.update(deltaTime));

    // Check for collisions
    checkCollisions();

    renderer.render(scene, camera);
}

animate();

// Add restart functionality
restartButton.addEventListener('click', () => {
    // Reset game state
    gameOver = false;
    gameOverElement.style.display = 'none';
    
    // Clear existing villagers and their blood pools
    while (villagers.length > 0) {
        const villager = villagers.pop();
        if (villager.bloodPool) {
            scene.remove(villager.bloodPool);
        }
        scene.remove(villager.mesh);
    }
    
    // Reset score
    score = 0;
    scoreElement.textContent = `Score: ${score}`;
    
    // Create new villagers
    for (let i = 0; i < NUMBER_OF_VILLAGERS; i++) {
        const x = Math.random() * 20 - 10;
        const z = Math.random() * 20 - 10;
        const villager = new Villager(x, z);
        villagers.push(villager);
        scene.add(villager.mesh);
    }
    
    // Request pointer lock to start playing
    renderer.domElement.requestPointerLock();
}); 