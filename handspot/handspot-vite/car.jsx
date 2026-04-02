import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function SongCarousel() {
  const mountRef = useRef(null);
  const rendererRef = useRef(null); 
  const cameraRef = useRef(null);
  const cardsRef = useRef([]);
  const targetRotationRef = useRef(0);
  const currentRotationRef = useRef(0);
  const animFrameRef = useRef(null);
  const videoRef =  useRef(null);
  const songsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const handLandmarkerRef = useRef(null);
  const detectionLoopRef = useRef(null);
  const canvasRef = useRef(null);
  const lastPointXRef = useRef(null);
  const lastPointYRef = useRef(null);
  const lastFistRef = useRef(false);
  const lastVolTimeRef = useRef(0);

  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const CARD_COUNT = songs.length || 1;

  const ellaref = useRef(4.8);
  const ellbref = useRef(3.6);
  const CARD_W = 1.2;
  const CARD_H = 1.2;

  useEffect(() => {
  fetch("http://localhost:8080/api/songs")
    .then((res) => res.json())
    .then((data) => {
      if (data.length === 0) {
        window.location.href = "http://localhost:8080/login";
      } else {
        setSongs(data);
        songsRef.current = data;
      }
    })
    .catch(() => {
      window.location.href = "http://localhost:8080/login";
    });
}, []);


  
  useEffect(() => {
    if (!songs.length) return;

    const mount = mountRef.current;

    if (rendererRef.current) {
      mount.removeChild(rendererRef.current.domElement);
    }

    const W = mount.clientWidth;
    const H = mount.clientHeight;
    const CARD_COUNT = songs.length;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 100);
    camera.position.set(3, 4, 13);
    camera.lookAt(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffbf00, 0.5));

    const dirLight = new THREE.DirectionalLight(0xadd8e6, 0.8);
    dirLight.position.set(19, 20, 5);
    scene.add(dirLight);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        transparent: true,
        opacity: 0.4,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.1;
    scene.add(plane);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const cards = [];

    for (let i = 0; i < CARD_COUNT; i++) {
      const song = songs[i];
      const group = new THREE.Group();

      const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);

      const texture = loader.load(song.cover);

      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: false,
      });

      const card = new THREE.Mesh(geo, mat);
      group.add(card);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(CARD_W, CARD_H, 0.02)),
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.2,
        })
      );

      group.add(edges);

      scene.add(group);
      cards.push({ group, index: i });
    }

    cardsRef.current = cards;

    const positionCards = (rotation) => {
      for (let i = 0; i < CARD_COUNT; i++) {
        const { group } = cards[i];
        const angle = (i / CARD_COUNT) * Math.PI * 2 + rotation;

        const x = ellaref.current * Math.sin(angle);
        const z = ellbref.current * Math.cos(angle);

        group.position.set(x, 0, z);
        group.rotation.y = angle;

        const depth = (z + ellbref.current) / (2 * ellbref.current);
        const scale = 0.65 + depth * 0.35;
        group.scale.setScalar(scale);
      }
    };

    const getFrontIndex = (rotation) => {
      let best = 0;
      let maxZ = -Infinity;

      for (let i = 0; i < CARD_COUNT; i++) {
        const angle = (i / CARD_COUNT) * Math.PI * 2 + rotation;
        const z = ellbref.current * Math.cos(angle);

        if (z > maxZ) {
          maxZ = z;
          best = i;
        }
      }

      return best;
    };

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      currentRotationRef.current +=
        (targetRotationRef.current - currentRotationRef.current) * 0.07;

      positionCards(currentRotationRef.current);

      const front = getFrontIndex(currentRotationRef.current);
      setCurrentIndex(front);
      currentIndexRef.current = front;

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      const W = mount.clientWidth;
      const H = mount.clientHeight;

      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
  }
    };
  }, [songs]);

useEffect(() => {
  const initHandLandmarker = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      console.log("HandLandmarker ready");
    } catch (err) {
      console.error("initHandLandmarker failed:", err);
    }
  };

  initHandLandmarker();
}, []);

const lastVideoTimeRef = useRef(-1);
const runningModeRef = useRef("VIDEO");

async function predictWebcam() {
    if (!handLandmarkerRef.current) {
    console.log("model not ready yet");
    return;
  }
  const video = videoRef.current;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const handLandmarker = handLandmarkerRef.current;

  if (runningModeRef.current === "IMAGE") {
    runningModeRef.current = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  const startTimeMs = performance.now();

  if (lastVideoTimeRef.current !== video.currentTime) {
    lastVideoTimeRef.current = video.currentTime;
    const results = handLandmarker.detectForVideo(video, startTimeMs);
if (results.landmarks && results.landmarks.length > 0) {
  const rightHand = results.landmarks[results.handednesses.findIndex(h => h[0].displayName === "Right")];
  const leftHand = results.landmarks[results.handednesses.findIndex(h => h[0].displayName === "Left")];

  if (leftHand){
  const landmarks = leftHand;

  const isPointing = (landmarks) => {
    const indexUp = landmarks[8].y < landmarks[6].y;
    const othersDown = [12, 16, 20].every(tip => 
      landmarks[tip].y > landmarks[tip - 2].y
    );
    return indexUp && othersDown;
  };

  const isShut = (landmarks) =>{
    const tips = [8, 12, 16, 20].every(tip => landmarks[tip].y > landmarks[tip - 2].y);
    return tips;
  };

  const shut = isShut(landmarks);

if (isPointing(landmarks) && !shut) {
  const x = landmarks[8].x;
  const y = landmarks[8].y;
  if (lastPointXRef.current !== null) {
    const dx = x - lastPointXRef.current;
    targetRotationRef.current += dx * 3;

    const dy = y - lastPointYRef.current;
    ellaref.current = Math.max(1.5, Math.min(ellaref.current + dy * 3, 10));
    ellbref.current = Math.max(1.5, Math.min(ellbref.current + dy * 3, 10));
  }

  lastPointXRef.current = x;
  lastPointYRef.current = y;
} else {
  lastPointXRef.current = null;
  lastPointYRef.current = null;
}


if(shut && !lastFistRef.current){
    const song = songsRef.current[currentIndexRef.current];
    if(song?.uri) playSong(song.uri);
}
  lastFistRef.current = shut;
}

if (rightHand){
  const randmarks = rightHand;
  const thumbTip = randmarks[4]
  const indexTip = randmarks[8];

  const dist_x = indexTip.x - thumbTip.x;
  const dist_y = indexTip.y - thumbTip.y;
  const eval_dist = Math.hypot(dist_x, dist_y);
  const vol = Math.round(Math.min(Math.max((eval_dist - 0.02) / 0.38, 0), 1) * 100);
  const now = performance.now();
  if (now - lastVolTimeRef.current > 200) {
    volControl(vol);
    lastVolTimeRef.current = now;
  }
  console.log(vol);
}
}
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5,
            });
            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
        }
    }

    ctx.restore();

  }

  detectionLoopRef.current = requestAnimationFrame(predictWebcam);
}
const playSong = (uri) => {
  fetch("http://localhost:8080/api/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }),
  });
};

const volControl = (vol) =>{
  fetch(`http://localhost:8080/api/volume?volume_percent=${vol}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  })
};
const startCam = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 500 } });
    const video = videoRef.current;
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadeddata = () => resolve();
    });

    while (!handLandmarkerRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }

    video.play();

    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    predictWebcam();
  } catch (err) {
    console.error("error:", err);
  }
};

const stopCam = () => {
    if(detectionLoopRef.current){
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    lastVideoTimeRef.current = -1;
  };

  const rotate = (dir) => {
    const step = (Math.PI * 2) / CARD_COUNT;
    targetRotationRef.current += dir * step;
  };

  const song = songs[currentIndex] || {
    title: "",
    artist: "",
  };

  if (!songs.length) {
    return <div style={{ color: "white", padding: 20 }}>Loading...</div>;
  }

  return (
    <div
      style={{
        overflow: "hidden",
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(ellipse at 30% 40%, #b2b2ccff 0%, #8888a0ff 100%)",
        position: "relative",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* UI */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          color: "white",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.5 }}>Now Playing</div>
        <div> <img width="200" height="200" src= {song.cover}></img></div>
        <div style={{ fontSize: 20 }}>{song.title}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{song.artist}</div>
      </div>
        <div
            style={{
                position: "relative",
                top: 20,
                left: 1300,
            }}
            >
            <video ref={videoRef} style={{ position: "absolute", top: 20, left: 0, zIndex: 0 }} autoPlay />
            <canvas ref={canvasRef} style={{ position: "absolute", top: 20, left: 0, zIndex: 1 }} />

            <button onClick={startCam}> startfeed </button>
            <button onClick={stopCam}> stop</button>
        </div>
      {/* Controls */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 20,
        }}
      >
        <button onClick={() => rotate(1)}>‹</button>
        <div style={{ color: "white" }}>
          {currentIndex + 1} / {songs.length}
        </div>
        <button onClick={() => rotate(-1)}>›</button>
      </div>
    </div>
    
  );
}
