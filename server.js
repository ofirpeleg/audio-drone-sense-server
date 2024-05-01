const path = require("path");
const fs = require("fs");
const express = require("express");
const WebSocket = require('ws');
const { exec } = require('child_process');
const helper = require('./js/helper.js');
const AWS = require('aws-sdk');

require('dotenv').config();

const app = express();

const WS_PORT = process.env.WS_PORT || 3000;
const HTTP_PORT = process.env.HTTP_PORT || 4000;

// Configure AWS with environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Set up S3 client
const s3 = new AWS.S3();

const wss = new WebSocket.Server({ port: PORT })


// array of connected websocket clients
let connectedClients = [];
let audioBuffer = [];

function processAndSaveAudio(audioBuffer) {
  const tempFilePath = path.join(__dirname, 'tempAudio.raw');
  const outputFilePath = path.join(__dirname, 'output.mp3');

  // Ensure the directory for the output file exists
  if (!fs.existsSync(path.dirname(outputFilePath))) {
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  }

  // Save the raw audio data to a temporary file
  fs.writeFileSync(tempFilePath, Buffer.concat(audioBuffer));

  // Construct the ffmpeg command
  const ffmpegCommand = `ffmpeg -f s16le -ar 11025 -ac 1 -i "${tempFilePath}" -filter:a "volume=10dB" "${outputFilePath}"`;

  // Execute the ffmpeg command
  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }

    // After successful conversion, upload to S3
    uploadFileToS3(outputFilePath);
  });
}

function uploadFileToS3(filePath) {
  const fileContent = fs.readFileSync(filePath);
  const bucketName = 'drone-sense-audio';
  const key = helper.generateFileName();
  console.log(key); // Example output: 2024-04-27_15-30.mp3

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'audio/mp3'
  };

  s3.upload(params, function(err, data) {
    if (err) {
      console.error("Error uploading data: ", err);
    } else {
      console.log("Successfully uploaded data to " + bucketName + "/" + key);
      // Clean up local files after upload
      fs.unlinkSync(filePath);
      fs.unlinkSync(path.join(__dirname, 'tempAudio.raw'));
    }
  });
}

wss.on("connection", (ws, req) => {
  console.log("Connected");
  // add new connected client
  connectedClients.push(ws);
   // Initialize an empty buffer for this connection
   audioBuffer = [];
  // listen for messages from the streamer
  ws.on("message", (data) => {
    console.log(data);
    audioBuffer.push(data);
    connectedClients.forEach((ws, i) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      } else {
        connectedClients.splice(i, 1);
      }
    });
  });
  ws.on("close", () => {
    console.log("Connection closed");
    // When connection closes, process and save the audio
    processAndSaveAudio(audioBuffer);
    audioBuffer = [];
  });
});

app.use("/image", express.static("image"));
app.use("/js", express.static("js"));


app.listen(HTTP_PORT, () =>
  console.log(`HTTP server`)
);
