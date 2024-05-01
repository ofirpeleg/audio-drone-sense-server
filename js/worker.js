// worker.js
self.addEventListener('message', function (e) {
    var mean = 0;
    var samples_read = e.data.byteLength / 2;  // Each sample is 16 bits -> 2 bytes
    if (samples_read > 0) {
        var byteArray = new Int16Array(e.data);  // Interpret the data as an array of 16-bit integers

        for (var i = 0; i < byteArray.length; ++i) {  // Iterate over the length of the array
            mean += byteArray[i];
        }

        mean /= byteArray.length;  // Divide by the length of the array to get the mean
        self.postMessage(mean);
    }
});
