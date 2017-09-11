(function (window) {  
    //创建一个新的对象URL,该对象URL可以代表某一个指定的File对象或Blob对象. 
    window.URL = window.URL || window.webkitURL;  
    //提醒用户需要使用音频(0或者1)和(0或者1)视频输入设备
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;  
  
    var GintRecord = function (stream, config) {  
        config = config || {};  
        config.outputBits = config.outputBits || 8;      //采样数位 8, 16  
        config.outputRate = config.outputRate || (44100 / 6);   //采样率(1/6 44100)  
  
        //创建一个音频环境对象  
        audioContext = window.AudioContext || window.webkitAudioContext;  
        //AudioContext接口表示由音频模块连接而成的音频处理图，每个模块对应一个AudioNode。AudioContext可以控制它所包含的节点的创建，以及音频处理、解码操作的执行
        var context = new audioContext(); 
        //给定媒体流,确定操作对象
        var audioInput = context.createMediaStreamSource(stream);  
        var draw;
        var closeDraw;
        //是否可视化
        if(config.visualization){
            //AnalyserNode接口表示能够提供实时频率和时域分析信息的节点。 它是一个音频节点，将音频流从输入传递到输出，但允许您获取生成的数据，处理它并创建音频可视化 
            var analyser = context.createAnalyser();
            var distortion = context.createWaveShaper();
            //定义canvas
            var canvas = config.visualization.visualId;
            var canvasCtx = canvas.getContext("2d");
            //节点连接到您的音频源
            audioInput.connect(analyser);
            analyser.connect(distortion);
            distortion.connect(context.destination);

            if(config.visualization.visualSetting === 'sinewave'){
                analyser.fftSize = 2048;
                var bufferLength = analyser.frequencyBinCount;
                var dataArray = new Uint8Array(bufferLength);
                analyser.getByteTimeDomainData(dataArray);
                //绘制当前音频源示波器
                draw = function() {
                    drawVisual = requestAnimationFrame(draw);
                    analyser.getByteTimeDomainData(dataArray);
                    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                    canvasCtx.lineWidth = 2;
                    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
                    canvasCtx.beginPath();

                    var sliceWidth = canvas.width * 1.0 / bufferLength;
                    var x = 0;
                    for (var i = 0; i < bufferLength; i++) {
                        var v = dataArray[i] / 128.0;
                        var y = v * canvas.height / 2;
                        if (i === 0) {
                            canvasCtx.moveTo(x, y);
                        } else {
                            canvasCtx.lineTo(x, y);
                        }
                        x += sliceWidth;
                    }
                    canvasCtx.lineTo(canvas.width, canvas.height / 2);
                    canvasCtx.stroke();
                };
                closeDraw = function(){
                    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                    canvasCtx.fillStyle = "black";
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                };
            }else if (config.visualization.visualSetting === 'frequencybars'){
                analyser.fftSize = 256;
                var bufferLengthAlt = analyser.frequencyBinCount;
                var dataArrayAlt = new Uint8Array(bufferLengthAlt);
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                draw = function() {
                    drawVisual = requestAnimationFrame(draw);
                    analyser.getByteFrequencyData(dataArrayAlt);
                    canvasCtx.fillStyle = 'rgb(0, 0, 0)';
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                    var barWidth = (canvas.width / bufferLengthAlt) ;
                    var barHeight;
                    var x = 0;
                    for(var i = 0; i < bufferLengthAlt; i++) {
                        barHeight = dataArrayAlt[i];
                        canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
                        canvasCtx.fillRect(x,canvas.height-barHeight/2,barWidth,barHeight/2);
                        x += barWidth + 1;
                    }
                };
                closeDraw = function(){
                    cancelAnimationFrame(drawVisual);
                    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                    canvasCtx.fillStyle = "black";
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                };
            }
        }

        //设置音量节点  
        var volume = context.createGain();  
        audioInput.connect(volume);  
  
        // 以采样帧为单位的缓冲区大小。
        var bufferSize = 256;  
  
        // 创建声音的缓存节点，createScriptProcessor方法的  
        //如果指定，bufferSize必须是以下值之一：256,512,1024,2048,4096,8192,16384.如果没有传入，或者如果值为0，那么实现将选择最佳的缓冲区大小给定的环境
        // 第二个和第三个参数指的是输入和输出都是双声道。  
        var recorder = context.createScriptProcessor(bufferSize, 2, 2); 
         
        //用来储存读出的麦克风数据，和压缩这些数据，将这些数据转换为WAV文件的格式
        var audioData = {  
            size: 0          //录音文件长度  
            , buffer: []     //录音缓存  
            , inputSampleRate: context.sampleRate    //输入采样率  
            , inputSampleBits: 16       //输入采样数位 8, 16  
            , outputSampleRate: config.outputRate    //输出采样率  
            , oututSampleBits: config.outputBits       //输出采样数位 8, 16  
            , input: function (data) {  
                this.buffer.push(new Float32Array(data));  
                this.size += data.length;  
            }  
            , compress: function () { //合并压缩  
                //合并  
                var data = new Float32Array(this.size);  
                var offset = 0;  
                for (var i = 0; i < this.buffer.length; i++) {
                    data.set(this.buffer[i], offset);  
                    offset += this.buffer[i].length;  
                }  
                //压缩  
                var compression = parseInt(this.inputSampleRate / this.outputSampleRate);  
                var length = data.length / compression;  
                var result = new Float32Array(length);  
                var index = 0, j = 0;  
                while (index < length) {  
                    result[index] = data[j];  
                    j += compression;  
                    index++;  
                }  
                return result;  
            }  
            , encodeWAV: function () {  
                var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);  
                var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);  
                var bytes = this.compress();  
                var dataLength = bytes.length * (sampleBits / 8);  
                var buffer = new ArrayBuffer(44 + dataLength);  
                var data = new DataView(buffer);  
  
                var channelCount = 1;//单声道  
                var offset = 0;  
  
                var writeString = function (str) {  
                    for (var i = 0; i < str.length; i++) {  
                        data.setUint8(offset + i, str.charCodeAt(i));  
                    }  
                };  
                  
                // 资源交换文件标识符   
                writeString('RIFF'); offset += 4;  
                // 下个地址开始到文件尾总字节数,即文件大小-8   
                data.setUint32(offset, 36 + dataLength, true); offset += 4;  
                // WAV文件标志  
                writeString('WAVE'); offset += 4;  
                // 波形格式标志   
                writeString('fmt '); offset += 4;  
                // 过滤字节,一般为 0x10 = 16   
                data.setUint32(offset, 16, true); offset += 4;  
                // 格式类别 (PCM形式采样数据)   
                data.setUint16(offset, 1, true); offset += 2;  
                // 通道数   
                data.setUint16(offset, channelCount, true); offset += 2;  
                // 采样率,每秒样本数,表示每个通道的播放速度   
                data.setUint32(offset, sampleRate, true); offset += 4;  
                // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8   
                data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;  
                // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8   
                data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;  
                // 每样本数据位数   
                data.setUint16(offset, sampleBits, true); offset += 2;  
                // 数据标识符   
                writeString('data'); offset += 4;  
                // 采样数据总数,即数据总大小-44   
                data.setUint32(offset, dataLength, true); offset += 4;  
                // 写入采样数据   
                if (sampleBits === 8) {  
                    for (var i = 0; i < bytes.length; i++, offset++) {  
                        var s = Math.max(-1, Math.min(1, bytes[i]));  
                        var val = s < 0 ? s * 0x8000 : s * 0x7FFF;  
                        val = parseInt(255 / (65535 / (val + 32768)));  
                        data.setInt8(offset, val, true);  
                    }  
                } else {  
                    for (var i = 0; i < bytes.length; i++, offset += 2) {  
                        var s = Math.max(-1, Math.min(1, bytes[i]));  
                        data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);  
                    }  
                }  
  
                return new Blob([data], { type: 'audio/wav' });  
            }  
        };  
  
        //开始录音  
        this.start = function () {  
            audioInput.connect(recorder);  
            recorder.connect(context.destination); 
            if(config.visualization){
                draw(); 
            };
        };  
  
        //停止  
        this.stop = function () {  
            recorder.disconnect();  
            if(config.visualization){
                closeDraw();
            };
        };  
  
        //获取音频文件  
        this.getBlob = function () {  
            this.stop();  
            return audioData.encodeWAV();  
        };  
  
        //回放  
        this.play = function (audio) {  
            audio.src = window.URL.createObjectURL(this.getBlob());  
        };  
  
        //上传  
        this.upload = function (url,pdata, callback) {  
            var fd = new FormData();  
            fd.append('file', this.getBlob());  
            var xhr = new XMLHttpRequest();
            for (var e in pdata)
                    fd.append(e, pdata[e]);  
            if (callback) {  
                xhr.upload.addEventListener('progress', function (e) {  
                    callback('uploading', e);  
                }, false);  
                xhr.addEventListener('load', function (e) {  
                    callback('ok', e);  
                }, false);  
                xhr.addEventListener('error', function (e) {  
                    callback('error', e);  
                }, false);  
                xhr.addEventListener('abort', function (e) {  
                    callback('cancel', e);  
                }, false);  
            }  
            xhr.open('POST', url);  
            xhr.send(fd);  
        };

        //音频采集  
        recorder.onaudioprocess = function (e) {  
            audioData.input(e.inputBuffer.getChannelData(0));  
        };  
  
    };  
    //是否支持录音  
    GintRecord.canRecording = (navigator.getUserMedia != null);  
    //获取录音机  
    GintRecord.get = function (callback,errCallBack,config) {  
        if (callback) {  
            if (navigator.getUserMedia) {  
                navigator.getUserMedia(  
                    { audio: true } //只启用音频  
                    , function (stream) {  
                        //stream这个参数是麦克风的输入流，将这个流传递给GintRecord
                        var rec = new GintRecord(stream, config);  
                        callback(rec);  
                    }  
                    , function (error) {  
                        switch (error.code || error.name) {  
                            case 'PERMISSION_DENIED':  
                            case 'PermissionDeniedError':  
                                errCallBack('用户拒绝提供信息。');  
                                break;  
                            case 'NOT_SUPPORTED_ERROR':  
                            case 'NotSupportedError':  
                                errCallBack('浏览器不支持硬件设备。');  
                                break;  
                            case 'MANDATORY_UNSATISFIED_ERROR':  
                            case 'MandatoryUnsatisfiedError':  
                                errCallBack('无法发现指定的硬件设备。');  
                                break;  
                            default:  
                                errCallBack('无法打开麦克风。异常信息:' + (error.code || error.name));  
                                break;  
                        }  
                    });  
            } else {  
                errCallBack('浏览器不支持录音功能。'); return;  
            }  
        }  
    };  
    window.GintRecord = GintRecord;  
  
})(window);  