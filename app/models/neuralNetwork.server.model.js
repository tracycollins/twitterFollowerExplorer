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
	successRate: { 
		type: Number,
		default: 0
	},
	networkType: { 
		type: String
	},
	network: { // JSON
		type: Object
	},
	inputs: { 
		type: Array,
		default: []
	},
	outputs: { 
		type: Array,
		default: []
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