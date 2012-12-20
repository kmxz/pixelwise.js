Pw.filters = {};

/***************
sample naive filters

taking an [r, g, b, a] array, each ranging from [0, 255].
***************/

Pw.filters.dummy = function(pixel) {
    return pixel;
}

Pw.filters.monochrome = function(pixel) {
    var l = Pw.color.brightness(pixel, Pw.BRIGHTNESS.CIE);
    return [l, l, l, pixel[3]];
}

Pw.filters.inverse = function(pixel) {
    return [255 - pixel[0], 255 - pixel[1], 255 - pixel[2], pixel[3]];
}

Pw.filters.black = function(pixel) {
    return [0, 0, 0, pixel[3]];
}

Pw.filters.white = function(pixel) {
    return [255, 255, 255, pixel[3]];
}

Pw.filters.threshold = function(pixel) {
    return Pw.color.brightness(pixel, Pw.BRIGHTNESS.LUMINANCE) > Pw.filters.threshold_value ? black(pixel) : white(pixel);
}

Pw.filters.threshold_value = 127;

/**************
passive full filters

this kind of filter will take information from the whole image when working. however, they're passively called each time for each pixel. also, returning one single pixel is expected
**************/

Pw.filters.non_even_stretch = function(x, y, ido, dbg) {
    var temp = ido.read(ido.width/2+((x > ido.width/2) ? 1 : -1)*Math.sqrt(Math.abs(x - ido.width/2)/(ido.width/2))*(ido.width/2), y);
    return temp;
}

/**************
quarter matrix filters

return a quadrand of the convolve matrix (including the axis)
**************/

Pw.quad_matrix = [];

Pw.quad_matrix.gaussian = function(sigma) {
    var ret = [];
    var coef = 1/(2*sigma*sigma);
    var cal_rad = sigma * 3;
    var total = 0;
    for (var i = 0; i < cal_rad; i++) {
        ret[i] = [];
        for (var j = 0; j < cal_rad; j++) {
            ret[i][j] = Math.exp(-(i*i+j*j)*coef);
            total += (i ? 2 : 1)*(j ? 2 : 1) * ret[i][j];
        }
    }
    total = 1/total;
    for (var i = 0; i < cal_rad; i++) {
        Pw.vector.multBy(ret[i], total);
    }
    return ret;
}