function getCookie(req, name) {
    var value = "; " + req.headers.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
}
const decipher = (salt) => {
    const textToChars = (text) =>
        text.split("").map((c) => c.charCodeAt(0));
    const applySaltToChar = (code) =>
        textToChars(salt).reduce((a, b) => a ^ b, code);
    return (encoded) =>{
        if (encoded) {
            encoded
                .match(/.{1,2}/g)
                .map((hex) => parseInt(hex, 16))
                .map(applySaltToChar)
                .map((charCode) => String.fromCharCode(charCode))
                .join("");
            
        } else {
            null
        }
    }
};

//To decipher, you need to create a decipher and use it:
const myDecipher = decipher("PgKULKuJsv");

module.exports= {myDecipher,getCookie}