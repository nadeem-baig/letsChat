//
// log
//

'use strict';

var mongoose = require('mongoose')


var UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    link: {
        type: String,
        required: true,
    },
    roomnumber: {
        type: String,
        required: true,
    },
    datetime: {
        type: Date,
        default: Date.now,
        unique: true

    }
}, {
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true
    },
    usePushEach: true
});



// EXPOSE ONLY CERTAIN FIELDS
// It's really important that we keep
// stuff like password private!
UserSchema.method('toJSON', function() {
    return {
        email: this.email,
        link: this.link,
        roomnumber: this.roomnumber,
        datetime: this.datetime
    };
});

module.exports = mongoose.model('Userlog', UserSchema);
