// Global UI elements:
//  - log: event log
//  - trans: transcription window

// Global objects:
//  - isConnected: true iff we are connected to a worker
//  - tt: simple structure for managing the list of hypotheses
//  - dictate: dictate object with control methods 'init', 'startListening', ...
//       and event callbacks onResults, onError, ...

var isMicrophoneInitialized = false;
var isConnected = false;
var numWorkersAvailable = 0;


var startPosition = 0;
var endPosition = 0;
var doUpper = false;
var doPrependSpace = true;

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function prettyfyHyp(text, doCapFirst, doPrependSpace) {
	if (doCapFirst) {
		text = capitaliseFirstLetter(text);
	}
	tokens = text.split(" ");
	text = "";
	if (doPrependSpace) {
		text = " ";
	}
	doCapitalizeNext = false;
	tokens.map(function(token) {
		if (text.trim().length > 0) {
			text = text + " ";
		}
		if (doCapitalizeNext) {
			text = text + capitaliseFirstLetter(token);
		} else {
			text = text + token;
		}
		if (token == "." ||  /\n$/.test(token)) {
			doCapitalizeNext = true;
		} else {
			doCapitalizeNext = false;
		}
	});
	
	text = text.replace(/ ([,.!?:;])/g,  "\$1");
	text = text.replace(/ ?\n ?/g,  "\n");
	return text;
}	

function updateDisabledState() {
  var disabled = false;
  var text = "Dikteerimiseks vajuta nuppu";
  if (!isMicrophoneInitialized) {
    disabled = true;
    text = "Mikrofon initsialiseerimata";
  } else if (isConnected) {
    disabled = false;
    text = "Räägi...";
  } else if (numWorkersAvailable == 0) {
    disabled = true;
    text = "Server ülekoormatud või rivist väljas";
  }
  if (disabled) {
    $("#recbutton").addClass("disabled");
    $("#helptext").html(text);
  } else {
    $("#recbutton").removeClass("disabled");
    $("#helptext").html(text);
  }
}
  
function getAverage(array) {
    var values = 0;
    var average;
    var length = array.length;
    // get all the frequency amplitudes
    for (var i = 0; i < length; i++) {
        values += array[i];
    }
    average = values / length;
    return average;
}


function rafCallback(time) {

  window.webkitRequestAnimationFrame(rafCallback, this);
  if (isConnected) {
    var freqByteData = new Uint8Array(userSpeechAnalyser.frequencyBinCount);
    userSpeechAnalyser.getByteFrequencyData(freqByteData); 
    var average = getAverage(freqByteData);
    $("#recbutton").css({"background-color": "rgba(255, 0, 0, " + Math.log(average)/Math.log(256)  +" )"});
  } else {
    $("#recbutton").css({"background-color": "rgba(255, 0, 0, 0.0)"});
  }
}

  
  

var dictate = new Dictate({
		server : "ws://bark.phon.ioc.ee:82/dev/duplex-speech-api/ws/speech",
		serverStatus : "ws://bark.phon.ioc.ee:82/dev/duplex-speech-api/ws/status",
		//server : "ws://bayes:8888/client/ws/speech",
		//serverStatus : "ws://bayes:8888/client/ws/status",
    
		recorderWorkerPath : "{{ media_url('js/libs/dictate.js/lib/recorderWorker.js') }}",
		onReadyForSpeech : function() {
			isConnected = true;
			__message("READY FOR SPEECH");
      $("#recbutton").addClass("playing");
      $("#helptext").html("Räägi");
			startPosition = $("#trans").prop("selectionStart");
			endPosition = startPosition;
			var textBeforeCaret = $("#trans").val().slice(0, startPosition);
			if ((textBeforeCaret.length == 0) || /\. *$/.test(textBeforeCaret) ||  /\n *$/.test(textBeforeCaret)) {
				doUpper = true;
			} else {
				doUpper = false;
			}
			doPrependSpace = (textBeforeCaret.length > 0) && !(/\n *$/.test(textBeforeCaret));
		},
		onEndOfSpeech : function() {
			__message("END OF SPEECH");
			$("#playbutton").addClass("disabled");
		},
		onEndOfSession : function() {
			isConnected = false;
			__message("END OF SESSION");
      $("#recbutton").removeClass("playing");
			updateDisabledState();      
		},
		onServerStatus : function(json) {
			__serverStatus(json.num_workers_available);
      numWorkersAvailable = json.num_workers_available;
      updateDisabledState();
		},
		onPartialResults : function(hypos) {
			hypText = prettyfyHyp(hypos[0].transcript, doUpper, doPrependSpace);
			val = $("#trans").val();
			$("#trans").val(val.slice(0, startPosition) + hypText + val.slice(endPosition));        
			endPosition = startPosition + hypText.length;
			$("#trans").prop("selectionStart", endPosition);
		},
		onResults : function(hypos) {
			hypText = prettyfyHyp(hypos[0].transcript, doUpper, doPrependSpace);
			val = $("#trans").val();
			$("#trans").val(val.slice(0, startPosition) + hypText + val.slice(endPosition));        
			startPosition = startPosition + hypText.length;			
			endPosition = startPosition;
			$("#trans").prop("selectionStart", endPosition);
			if (/\. *$/.test(hypText) ||  /\n *$/.test(hypText)) {
				doUpper = true;
			} else {
				doUpper = false;
			}
			doPrependSpace = (hypText.length > 0) && !(/\n *$/.test(hypText));
		},
		onError : function(code, data) {
			dictate.cancel();
			__error(code, data);
			// TODO: show error in the GUI
		},
		onEvent : function(code, data) {
			__message(code, data);
      if (code == 3 /* MSG_INIT_RECORDER */) {
        isMicrophoneInitialized = true;
        updateDisabledState();
      }
		},
    rafCallback : rafCallback
	});

// Private methods (called from the callbacks)
function __message(code, data) {
	console.log("msg: " + code + ": " + (data || ''));
}

function __error(code, data) {
	console.log("ERR: " + code + ": " + (data || ''))
}

function __serverStatus(msg) {
	serverStatusBar.innerHTML = msg;
}

function __updateTranscript(text) {
	$("#trans").val(text);
}

// Public methods (called from the GUI)
function toggleListening() {
	if (isConnected) {
		dictate.stopListening();
	} else {
		dictate.startListening();
	}
}

function cancel() {
	dictate.cancel();
}

function clearTranscription() {	
	$("#trans").val("");
	// needed, otherwise selectionStart will retain its old value
	$("#trans").prop("selectionStart", 0);	
	$("#trans").prop("selectionEnd", 0);	
}


$(document).ready(function() {
	dictate.init();
});
