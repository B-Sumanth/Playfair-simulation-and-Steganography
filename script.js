// ===== PLAYFAIR CIPHER =====

function generateMatrix(key) {
  key = key.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  let seen = new Set();
  let matrix = [];

  for (const c of key) {
    if (!seen.has(c)) {
      seen.add(c);
      matrix.push(c);
    }
  }

  for (let i = 0; i < 26; i++) {
    let ch = String.fromCharCode(65 + i);
    if (ch !== 'J' && !seen.has(ch)) {
      matrix.push(ch);
    }
  }

  return matrix;
}

function displayMatrix(matrix) {
  const grid = document.getElementById('matrixDisplay');
  grid.innerHTML = '';
  for (const letter of matrix) {
    const div = document.createElement('div');
    div.textContent = letter;
    grid.appendChild(div);
  }
}

function prepareText(text) {
  text = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
  let pairs = [];
  for (let i = 0; i < text.length; i += 2) {
    let a = text[i];
    let b = text[i + 1] || 'X';
    if (a === b) {
      b = 'X';
      i--;
    }
    pairs.push([a, b]);
  }
  return pairs;
}

function getPos(matrix, ch) {
  let idx = matrix.indexOf(ch);
  return [Math.floor(idx / 5), idx % 5];
}

function encryptPairs(pairs, matrix) {
  let result = '';
  let stepsText = '';

  pairs.forEach(([a, b]) => {
    let [r1, c1] = getPos(matrix, a);
    let [r2, c2] = getPos(matrix, b);
    let step = `${a}${b} → `;

    if (r1 === r2) {
      a = matrix[r1 * 5 + (c1 + 1) % 5];
      b = matrix[r2 * 5 + (c2 + 1) % 5];
      step += `Same Row → ${a}${b}`;
    } else if (c1 === c2) {
      a = matrix[((r1 + 1) % 5) * 5 + c1];
      b = matrix[((r2 + 1) % 5) * 5 + c2];
      step += `Same Col → ${a}${b}`;
    } else {
      a = matrix[r1 * 5 + c2];
      b = matrix[r2 * 5 + c1];
      step += `Rectangle → ${a}${b}`;
    }

    result += a + b;
    stepsText += step + '\n';
  });

  return { result, stepsText };
}

function startEncryption() {
  const key = document.getElementById('keyInput').value;
  const plaintext = document.getElementById('plainInput').value;

  const matrix = generateMatrix(key);
  displayMatrix(matrix);

  const pairs = prepareText(plaintext);
  const { result, stepsText } = encryptPairs(pairs, matrix);

  document.getElementById('steps').textContent = stepsText;
  document.getElementById('cipherOutput').textContent = result;
}

// ===== IMAGE ENCRYPTION / DECRYPTION =====

let originalCtx, encryptedCtx, img;
let originalPixels = null;

function handleImage(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    img = new Image();
    img.onload = function () {
      const originalCanvas = document.getElementById('originalCanvas');
      const encryptedCanvas = document.getElementById('encryptedCanvas');

      originalCanvas.width = encryptedCanvas.width = img.width;
      originalCanvas.height = encryptedCanvas.height = img.height;

      originalCtx = originalCanvas.getContext('2d');
      encryptedCtx = encryptedCanvas.getContext('2d');

      originalCtx.drawImage(img, 0, 0);

      // Save original pixels
      const imageData = originalCtx.getImageData(0, 0, img.width, img.height).data;
      originalPixels = Array.from(imageData); // Save copy for checking
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function hashKeyToSeed(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffleArray(array, seed) {
  let rng = mulberry32(seed);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function encryptImage() {
  const key = document.getElementById('imageKey').value;
  if (!originalCtx || !encryptedCtx || !key) {
    alert("Please upload an image and enter a key.");
    return;
  }

  const width = img.width;
  const height = img.height;
  const imageData = originalCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  }

  const seed = hashKeyToSeed(key);
  shuffleArray(pixels, seed);

  for (let i = 0; i < pixels.length; i++) {
    data[i * 4] = pixels[i][0];
    data[i * 4 + 1] = pixels[i][1];
    data[i * 4 + 2] = pixels[i][2];
    data[i * 4 + 3] = pixels[i][3];
  }

  encryptedCtx.putImageData(imageData, 0, 0);
}

function compareImages(currentData) {
  if (!originalPixels) return false;
  for (let i = 0; i < currentData.length; i++) {
    if (currentData[i] !== originalPixels[i]) {
      return false;
    }
  }
  return true;
}

function decryptImage() {
  const key = document.getElementById('imageKey').value;
  if (!originalCtx || !encryptedCtx || !key) {
    alert("Please upload an image and enter a key.");
    return;
  }

  const width = img.width;
  const height = img.height;
  const imageData = encryptedCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let shuffledPixels = [];
  for (let i = 0; i < data.length; i += 4) {
    shuffledPixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  }

  const seed = hashKeyToSeed(key);
  const indices = Array.from({ length: shuffledPixels.length }, (_, i) => i);
  const shuffledIndices = [...indices];
  shuffleArray(shuffledIndices, seed);

  let restoredPixels = new Array(shuffledPixels.length);
  for (let i = 0; i < shuffledPixels.length; i++) {
    restoredPixels[shuffledIndices[i]] = shuffledPixels[i];
  }

  for (let i = 0; i < restoredPixels.length; i++) {
    data[i * 4] = restoredPixels[i][0];
    data[i * 4 + 1] = restoredPixels[i][1];
    data[i * 4 + 2] = restoredPixels[i][2];
    data[i * 4 + 3] = restoredPixels[i][3];
  }

  encryptedCtx.putImageData(imageData, 0, 0);

  const isMatch = compareImages(imageData.data);
  if (isMatch) {
    alert("✅ Image successfully decrypted! It matches the original.");
  } else {
    alert("❌ Decryption failed or wrong key used.");
  }
}
