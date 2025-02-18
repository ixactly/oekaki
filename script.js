import {freelizer} from 'https://cdn.jsdelivr.net/npm/freelizer@1.0.0/index.min.js'

const MAX_NUM_HANDS = 2;
const MIC_THRESHOLD = 0.01

const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasElementForSave = document.getElementsByClassName('output_canvas_for_save')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
const canvasCtx = canvasElement.getContext('2d');
const loudnessElement = document.getElementById("loudness")

// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
  spinner.style.display = 'none';
};

let audio_data = {
  on: true,
  //0:白 1:赤 ... 8:黒
  color_index: 0
}

let back_button_cnt = 0
let forward_button_cnt = 0
let clear_flag = false

let audioCtx = null
let wavedata = null
let analyser = null

const audio_init = async () => {
  audioCtx = new (window.AudioContext
    || window.webkitAudioContext || window.mozAudioContext)();

  analyser = audioCtx.createAnalyser();
  wavedata = new Float32Array(analyser.fftSize);
  analyser.fftSize = 512;
  // analyser.connect(audioCtx.destination)
  const mic_stream = await navigator.mediaDevices.getUserMedia({audio: true});
  const mic_input = audioCtx.createMediaStreamSource(mic_stream);
  mic_input.connect(analyser);
}

window.onload = async () => {
  audio_init()
}

let on_pre = false
const audio_data_update = (data) => {
  // data例
  //{
  //   deviation: 28.924883259925537,
  //   frequency: 1075.4271444623207,
  //   note: "C",
  //   noteFrequency: 1046.5022612023952,
  //   octave: 6,
  // }

  let on = false
  if (analyser != null) {
    analyser.getFloatTimeDomainData(wavedata);
    const max = wavedata.reduce((a, b) => Math.max(a, b))
    loudnessElement.innerHTML = max
    on = max > MIC_THRESHOLD
  }
  if (on && Object.keys(data).includes("frequency") && data["frequency"] != 21.55425219941349) {
    audio_data.color_index = ((data.note.charCodeAt(0) - 65) + data.octave * 8) % 9;
  }
  audio_data.on = on | on_pre
  on_pre = on
}

  ; (async () => {
    try {
      const {start, stop, subscribe, unsubscribe} = await freelizer()
      start()
      subscribe(audio_data_update)
    } catch (error) {
      console.error(error);
    }
  })()

// // local fileを対象にworkerを起動すると出るエラーのための対処
// // https://tshino.hatenablog.com/entry/20180106/1515218776
// var newWorkerViaBlob = function(relativePath) {
//   var baseURL = window.location.href.replace(/\\/g, '/').replace(/\/[^\/]*$/, '/');
//   var array = ['importScripts("' + baseURL + relativePath + '");'];
//   var blob = new Blob(array, {type: 'text/javascript'});
//   var url = window.URL.createObjectURL(blob);
//   return new Worker(url);
// };
// var newWorker = function(relativePath) {
//   try {
//     return newWorkerViaBlob(relativePath);
//   } catch (e) {
//     return new Worker(relativePath);
//   }
// };

let render_worker = null;
let camera_img_from_mediapipe = null;


let oekaki_img = null;
if (window.Worker) {
  render_worker = new Worker("render.js")

  render_worker.onmessage = (e) => {
    oekaki_img = e.data;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(camera_img_from_mediapipe, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.putImageData(oekaki_img, 0, 0)
    canvasCtx.restore();
  }

} else {
  console.err("can't find window.Worker.");
}
//0.5秒ごとにfpsを計算して値を更新する
class fpsCheck {
  constructor(callback = null) {
    this.counter = 0
    this.intervalId = null;
    this.fps = -1
    //500ms
    this.update_period = 500;
    this.callback = callback
  }
  _update() {
    this.fps = this.counter / (this.update_period / 1000)
    this.counter = 0
    this.callback(this)
  }
  start() {
    if (this.intervalId == null) {
      //0.5sごとにupdate
      this.intervalId = setInterval(this._update.bind(this), this.update_period);
    }

  }
  stop() {
    if (!(this.intervalId == null)) {
      clearInterval(this.intervalId);
    }
    this.fps = -1;
  }
  tick() {
    this.counter++;
  }
}

let fpsch = new fpsCheck((_fpsch) => {
  document.getElementById("fps_display").innerHTML = _fpsch.fps.toString() + " fps"
})
fpsch.start();



let onresults_first = true
const onResults = (results) => {
  if (onresults_first) {
    // Hide the spinner.
    document.body.classList.add('loaded');
    onresults_first = false
  }

  fpsch.tick()
  camera_img_from_mediapipe = results.image
  const hands_found = results.multiHandLandmarks && results.multiHandedness
  const isRightHand = hands_found ?
    results.multiHandedness.map((classification, index, array) => {
      return classification.label === 'Right';
    })
    : null;
  const render_data = {
    msg: "main",
    audio_data: audio_data,
    hands_found: hands_found,
    isRightHand: isRightHand,
    landmarks: hands_found ? results.multiHandLandmarks : null,
    erase_mode: document.getElementById("pen_mode").value == "eraser",
    height: canvasElement.height,
    width: canvasElement.width,
    back_button_cnt: back_button_cnt,
    forward_button_cnt: forward_button_cnt,
    clear_flag: clear_flag
  }
  render_worker.postMessage(render_data);
  back_button_cnt = 0
  forward_button_cnt = 0
  clear_flag = false
}

const hands = new Hands({
  locateFile: (file) => {
    // return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1/${file}`;
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1.1612238212/${file}`;
  }
})

const options = {
  maxNumHands: MAX_NUM_HANDS,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
}

hands.setOptions(options);
hands.onResults(onResults);

/**
 * Instantiate a camera. We'll feed each frame we receive into the solution.
 */
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});
camera.start();

const save_paint = () => {

  if (!(oekaki_img == null)) {
    canvasElementForSave.getContext('2d').putImageData(oekaki_img, 0, 0)
  }

  if (canvasElementForSave.toBlob) {
    canvasElementForSave.toBlob((blob) => {
      saveAs(blob, "oekaki.png");
    }, "image/png");
  }
  canvasElementForSave.getContext('2d').clearRect(0, 0, canvasElement.width, canvasElement.height);
}

document.getElementById("back_button").onclick = () => {
  back_button_cnt += 1;
}
document.getElementById("forward_button").onclick = () => {
  forward_button_cnt += 1;
}

document.getElementById("save_button").onclick = () => {
  save_paint()
}

document.getElementById("clear_button").onclick = () => {
  clear_flag = true;
}

document.getElementById("fullOverlay").onclick = async () => {
  document.getElementById("fullOverlay").remove()
  await audioCtx.resume()
  await audio_init()
  console.log("audio context is resumed")
  // console.log("audio_init() is called")
}
// let susresBtn = document.getElementById("susresBtn")

// susresBtn.onclick = function() {
//   if(audioCtx.state === 'running') {
//     audioCtx.suspend().then(function() {
//       susresBtn.textContent = 'Resume context';
//     });
//   } else if(audioCtx.state === 'suspended') {
//     audioCtx.resume().then(function() {
//       susresBtn.textContent = 'Suspend context';
//     });
//   }
// }




