/****
sample naive filters

taking an [r, g, b, a] array, each ranging from [0, 255]
****/

function dummy(pixel) {
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