var mongoose = require('mongoose'),
	crypto = require('crypto'),
	moment = require('moment'),
	Schema = mongoose.Schema;

var NeuralNetworkSchema = new Schema({
	networkId: { 
		type: String,
		unique: true
	},
	network: { 
		type: Object,
		default: {}
	},
	networkCreateMode: { 
		type: String
	},
	successRate: { 
		type: Number,
		default: 0
	},
	networkType: { 
		type: String
	},
	numInputs: { 
		type: Number,
		default: 0
	},
	numOutputs: { 
		type: Number,
		default: 0
	},
	network: { // JSON
		type: Object
	},
	inputs: { 
		type: Object, // sub objects for each type of input
		default: {}
	},
	outputs: { 
		type: Array,
		default: []
	},
	elapsed: { 
		type: Number,
		default: 0
	},
	createdAt: { 
		type: Number,
		default: moment().valueOf()
	},
	evolve: {
		type: Object,
		default: {}
	},
	train: {
		type: Object,
		default: {}
	},
	test: {
		type: Object,
		default: {}
	}
});

mongoose.model("NeuralNetwork", NeuralNetworkSchema);