/***************
sample naive filters

taking an [r, g, b, a] array, each ranging from [0, 255].
***************/

function dummy_naive(pixel) {
    return [pixel[0], pixel[1], pixel[2], pixel[3]];
}

function monochrome(pixel) {
    var l = Pw.color.brightness(pixel, Pw.BRIGHTNESS.CIE);
    return [l, l, l, pixel[3]];
}

function inverse(pixel) {
    return [255 - pixel[0], 255 - pixel[1], 255 - pixel[2], pixel[3]];
}

function black(pixel) {
    return [0, 0, 0, pixel[3]];
}

function white(pixel) {
    return [255, 255, 255, pixel[3]];
}

function threshold(pixel) {
    return Pw.color.brightness(pixel, Pw.BRIGHTNESS.LUMINANCE) > 127 ? black(pixel) : white(pixel);
}

/**************
passive full filters

this kind of filter will take information from the whole image when working. however, they're passively called each time for each pixel. also, returning one single pixel is expected
**************/

function dummy_passive(x, y, ido) {
    return ido.read(x, y);
}

var gaussian_blur_cache = [];
var gaussian_current_radius;

function gaussianBlurInit(radius) {
    if (radius * 3 == gaussian_current_radius) { return; } else { gaussian_blur_cache = []; gaussian_current_radius = radius * 3; }
    var coef = 1/(2*radius*radius);
    var mult = coef/Math.PI;
    for (var i = 0; i < gaussian_current_radius; i++) {
        gaussian_blur_cache[i] = [];
        for (var j = 0; j < gaussian_current_radius; j++) {
            gaussian_blur_cache[i][j] = mult * Math.exp(-(i*i+j*j)*coef);
        }
    }
}

function gaussianBlurNoFill(x, y, ido) {
    var ret = [0, 0, 0, 0];
    var total_weight = 0;
    var fetch = function(dx, dy) {
        for (var i = -gaussian_current_radius + 1; i < gaussian_current_radius; i++) {
            
        }
    }
    //"Out of boundary."
}