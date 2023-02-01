'use strict';

if (typeof window !== 'undefined' && typeof exports === 'undefined') {
    if (typeof window.utils !== 'object') {
        window.utils = {};
    }
}

if (typeof exports !== 'undefined') {
    var _ = require('underscore');
}

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }
  

(function(exports) {
    //
    // Message Text Formatting
    //


    function encodeEntities(value) {
        return value.
            replace(/&/g, '&amp;').
            replace(surrogatePairRegexp, function(value) {
                var hi = value.charCodeAt(0),
                    low = value.charCodeAt(1);
                return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
            }).
            replace(nonAlphanumericRegexp, function(value) {
                return '&#' + value.charCodeAt(0) + ';';
            }).
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;');
    }

    function getBaseUrl() {
        var parts = window.location.pathname.split('/');

        parts = _.filter(parts, function(part) {
            return part.length;
        });

        var path = window.location.origin;

        if (parts.length) {
            path = path + '/' + parts.join('/');
        }

        return path + '/';
    }

    function trim(text) {
        return text.trim();
    }

    function mentions(text) {
        var mentionPattern = /\B@([\w\.]+)(?!@)\b/g;
        return text.replace(mentionPattern, '<span class="lcb-message-mention">@$1</span>');
    }

    function roomLinks(text, data) {
        if (!data.rooms) {
            return text;
        }

        var slugPattern = /\B(\#[a-z0-9_]+)\b/g;

        return text.replace(slugPattern, function(slug) {
            var s = slug.substring(1);
            var room = data.rooms.find(function(room) {
                return room.attributes.slug === s;
            });

            if (!room) {
                return slug;
            }

            return '<a href="#!/room/' + room.id + '">&#35;' + s + '</a>';
        });
    }

    function uploads(text) {
        var pattern = /^\s*(upload:\/\/[-A-Z0-9+&*@#\/%?=~_|!:,.;'"!()]*)\s*$/i;

        return text.replace(pattern, function(url) {
            return getBaseUrl() + url.substring(9);
        });
    }
    
    function links(text) {
        var id = uuidv4()
        if (imagePattern.test(text)) {
            return text.replace(imagePattern, function(url) {
                var uri = encodeEntities(_.unescape(url));
                return '<a class="thumbnail" id = "'+id+'" href="' + uri +'" src="' + uri +'" target="_blank" rel="noreferrer nofollow"><img src="' + uri +'" alt="Pasted Image"  onload="'+myFunction(id)+'" /></a>';
            });
        } else {
            return text.replace(linkPattern, function(url) {
                var uri = encodeEntities(_.unescape(url));
                return '<a href="' + uri + '" src="' + uri +'"   target="_blank" rel="noreferrer nofollow" id = "'+id+'" onload="'+myFunction(id)+'"  >' + decodeURIComponent(url.split("/").pop()) + '</a>';
            });
        }
    }

    function emotes(text, data) {
        var regex = new RegExp('\\B(:[a-z0-9_\\+\\-]+:)[\\b]?', 'ig');

        return text.replace(regex, function(group) {
            var key = group.split(':')[1];
            var emote = _.find(data.emotes, function(emote) {
                return emote.emote === key;
            });

            if (!emote) {
                return group;
            }

            var image = _.escape(emote.image),
                emo = _.escape(':' + emote.emote + ':'),
                size = _.escape(emote.size || 20);

            return '<img class="emote" src="' + image + '" title="' + emo + '" alt="' + emo + '" width="' + size + '" height="' + size + '" />';
        });
    }

    function replacements(text, data) {
        _.each(data.replacements, function(replacement) {
            text = text.replace(new RegExp(replacement.regex, 'ig'), replacement.template);
        });
        return text;
    }

    var surrogatePairRegexp = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
        // Match everything outside of normal chars and " (quote character)
        nonAlphanumericRegexp = /([^\#-~| |!])/g,
        imagePattern = /^\s*((https?|ftp):\/\/[-A-Z0-9\u00a1-\uffff+&@#\/%?=~_|!:,.;'"!()]*[-A-Z0-9\u00a1-\uffff+&@#\/%=~_|][.](jpe?g|png|gif))\s*(\?[\w-]+(=[\w-]*)?(&[\w-]+(=[\w-]*)?)*)?$/i,
        linkPattern = /((https?|ftp):\/\/[-A-Z0-9\u00a1-\uffff+&*@#\/%?=~_|!:,.;'"!()]*[-A-Z0-9\u00a1-\uffff+&@#\/%=~_|])/ig;

        function myFunction(id) {
            setTimeout(()=>{
                const container = document.getElementById(id);
                container?.addEventListener("click",HandleRequest)
            }, 10)

            function HandleRequest() {
                var img = document.getElementById(id);
                var src = img.getAttribute("src");                    
                var myHeaders = new Headers();
                myHeaders.append("Content-Type", "application/json");

                var raw = JSON.stringify({
                "data": src.toString()
                });

                var requestOptions = {
                method: 'POST',
                headers: myHeaders,
                body: raw,
                redirect: 'follow'
                };

                fetch("/log", requestOptions)
                .catch(error => console.log('error', error));
            }
          }

    exports.format = function(text, data) {
        var pipeline = [
            trim,
            mentions,
            roomLinks,
            uploads,
            links,
            emotes,
            replacements
        ];

        _.each(pipeline, function(func) {
            text = func(text, data);
        });

        return text;
    };

})(typeof exports === 'undefined' ? window.utils.message = {} : exports);
