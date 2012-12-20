/*     _         _        _            _    
  _ __(_)_ _____| |_ __ _(_)___ ___   (_)___
 | '_ \ \ \ / -_) \ V  V / (_-</ -_)_ | (_-<
 | .__/_/_\_\___|_|\_/\_/|_/__/\___(_)/ /__/
 |_|      bare metal nut pain       |__/

pixelwise.js

xkong@ust.hk

just fuck up canvas, no performance optimization
*/

/***************
constructors
***************/

/*
@param canvas_el the canvas element
*/
var Pw = function(canvas_el) {
    this.ctx = canvas_el.getContext('2d');
    this.w = canvas_el.clientWidth;
    this.h = canvas_el.clientHeight;
}

/*
@param mode the mode of sourced being used to setting up the mask, ranging in Pw.MASKMODE
@param source corresponds to the mode
       FUNCTION: a function taking x and y value in px, returning a number from 0 (transparent) to 1 (opaque)
       ALPHA/LUMINANCE: another Pw is used. alpha channel or luminance will be used
*/
Pw.Mask = function(mode, source) {
    switch (mode) {
        case Pw.MASKMODE.FUNCTION:
            if (typeof source != 'function') { throw "Input is not a function."; }
            this.func = source;
            break;
        case Pw.MASKMODE.ALPHA:
        case Pw.MASKMODE.LUMINANCE:
            if (!(source instanceof Pw)) { throw "We expect a Pw." }
            this.func = function(x, y) {
                if (source.h <= y || source.w <= x) { throw "Source canvas for mask is too small." }
                var pixel = source.ctx.getImageData(x, y, 1, 1).data;
                return (mode == Pw.MASKMODE.ALPHA) ? pixel[3]/255 : Pw.color.brightness(pixel, Pw.BRIGHTNESS.HSL)/255;
            }
            break;
        default:
            throw "No mask source mode specified.";
    }
}

/***************
interface
***************/

/*
@param img image, either a Image object or a string of URL
@param mode the mode to load, ranging in Pw.LOADMODE
*/
Pw.prototype.loadImg = function(img, mode) {
    var instance = this;
    if (typeof img == "string") {
        var im = new Image();
        im.onload = function() {
            instance._loadImg(im, mode);
        }
        im.src = img;
    } else {
        instance._loadImg(img);
    }
}

/*
@param filter the naive filter function to be applied (take a point and return its new value)
@param range the range to apply the filter on, can be
       _: full canvas
       array: specifying left, top, width, height
       mask: a Pw.Mask object
*/
Pw.prototype.applyNaiveFilter = function(filter, range) {
    var raw, opa, tdata;
    if (range instanceof Pw.Mask) { //in this mode, we read and write pixels ONE BY ONE, which might be slow. If many pixels need to written, full filter is suggested
        for (var i = 0; i < this.w; i++) {
            for (var j = 0; j < this.h; j++) {
                opa = range.func(i, j);
                if (opa <= 0) { continue; } //not used
                raw = this.ctx.getImageData(i, j, 1, 1).data; 
                tdata = this.ctx.createImageData(1, 1);             
                tdata.write(Pw.mix.mix(filter(raw), raw, opa, Pw.MIXMODE.REPLACE));
                this.ctx.putImageData(tdata, i, j);
            }        
        }
        return;
    } //not returned? non-mask mode
    if (!(range instanceof Array)) { //full canvas
        range = [0, 0, this.w, this.h];
    }
    //now range is an array
    raw = this.ctx.getImageData.apply(this.ctx, range).data; //in this mode, we read and write pixels ONLY ONCE, which is expected to be faster
    tdata = this.ctx.createImageData(range[2], range[3]); 
    for (var i = 0; i < raw.length; i += 4) {
        tdata.write(filter([raw[i], raw[i+1], raw[i+2], raw[i+3]]), i);
    } 
    this.ctx.putImageData(tdata, range[0], range[1]);
}

/*
@param matrix the matrix to be used
@param oob_const_color the color used in non-used area, a 4-array
@param oob_const_ratio the ratio of using color (other parts will be filled with mirror)
*/
Pw.prototype.applyQuarterMatrixFilter = function(matrix, oob_const_color, oob_const_ratio, range) {
    var w = matrix.length;
    var h = matrix[0].length;
    var raw = this.ctx.getImageData(0, 0, this.w, this.h); 
    var tdata = this.ctx.getImageData(0, 0, this.w, this.h);
    var opa;
    var pixel_buf;
    var temp;
    var fail;
    var total;
    for (var x = 0; x < this.w; x++) {
        for (var y = 0; y < this.h; y++) {
            opa = range ? range.func(x, y) : 1;
            if (opa <= 0) { continue; } //not used
            pixel_buf = [0, 0, 0, 0];
            for (var i = 0; i < w; i++) {
                for (var j = 0; j < h; j++) {
                    temp = [0, 0, 0, 0]; fail = 0; total = 0;
                    for (var m = -1; m <= i && m <= 1; m += 2) {
                        for (var n = -1; n <= j && n <= 1; n += 2) {
                            //if(x==y) { console.log(x, y, m, n); }
                            total++;
                            try {
                                Pw.vector.addTo(temp, raw.read(x + i * m, y + j * n));
                            } catch (e) {
                                if (e == "Out of boundary.") {
                                    fail++;
                                } else {
                                    throw e;
                                }
                            }
                        }
                    }
                    Pw.vector.multBy(temp, (total - fail * oob_const_ratio)/(total - fail));
                    Pw.vector.addTo(temp, Pw.vector.mult(oob_const_color, oob_const_ratio * fail));
                    Pw.vector.multBy(temp, matrix[i][j]);
                    Pw.vector.addTo(pixel_buf, temp);
                }
            }
            tdata.write(Pw.mix.mix(pixel_buf, raw.read(x,y), opa, Pw.MIXMODE.REPLACE), x, y);
        }
    }
    this.ctx.putImageData(tdata, 0, 0);
}

/*
@param filter the passive full filter function to be applied (take a coordinate and a ImageData object)
@param range the range to apply the filter on, can be a Pw.Mask object, or undefined for full canvas
*/
Pw.prototype.applyFullFilter = function(filter, range) {
    var raw = this.ctx.getImageData(0, 0, this.w, this.h); 
    var tdata = this.ctx.getImageData(0, 0, this.w, this.h);
    var opa;
    for (var i = 0; i < this.w; i++) {
        for (var j = 0; j < this.h; j++) {
            opa = range ? range.func(i, j) : 1;
            if (opa <= 0) { continue; }
            tdata.write(Pw.mix.mix(filter(i, j, raw, ((j == 25) ? true : false)), raw.read(i,j), opa, Pw.MIXMODE.REPLACE), i, j);
        }        
    }
    this.ctx.putImageData(tdata, 0, 0);
}

/***************
modifying native objects
***************/

/*
@param array the data to write
@param offset/x if y is not set, this parameter become x, otherwise it's bytewise offset. if omitted, offset = 0.
@param y
*/
ImageData.prototype.write = function(array, offset, y) {
    if (typeof y == 'number') {
        offset += y * this.width; offset = offset << 2;
    } else if (!(typeof offset == 'number')) {
        offset = 0;
    }
    for (var i = 0; i < array.length; i++) {
        this.data[offset+i] = Math.round(array[i]);
    }
}

/*
@param x x coordinate relative to this imagedata area
@param y y coordinate
*/
ImageData.prototype.read = function(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) { throw "Out of boundary."; }
    var offset = (y*this.width + x) << 2;
    return [this.data[offset], this.data[offset+1], this.data[offset+2], this.data[offset+3]];
}

/***************
constants
***************/

//for Pw
Pw.LOADMODE = { FILL: 1, FIT: 2, STRETCH: 3, TILE: 4, CENTER: 5, CENTERTILE: 6 };

//for Pw.mask
Pw.MASKMODE = { FUNCTION: 1, ALPHA: 2, LUMINANCE: 3 };

//for Pw.color
Pw.BRIGHTNESS = { HSL: 1, AVERAGE: 2, HSV: 3, CIE: 4 };

//for Pw.mix
Pw.MIXMODE = { REPLACEMENT: 1, VIEW: 2 };

/***************
general implementation
***************/

Pw.prototype._loadImg = function(img_obj, mode) {
    if (!img_obj.complete) { throw "Image not loaded yet."; }
    var instance = this;
    var draw_f = function(func) {
        var ratio = Math[func](instance.w / img_obj.width, instance.h / img_obj.height);
        instance.ctx.drawImage(img_obj, (instance.w - ratio * img_obj.width) / 2, (instance.h - ratio * img_obj.height) / 2, ratio * img_obj.width, ratio * img_obj.height);
    }
    var draw_t = function(il, it) {
        while (il < instance.w) {
            for (j = it; j < instance.h; j += img_obj.height) {
                instance.ctx.drawImage(img_obj, il, j);
            }
            il += img_obj.width;
        }
    }
    switch (mode) {
        case Pw.LOADMODE.FILL:
            draw_f("max");
            break;
        case Pw.LOADMODE.FIT:
            draw_f("min");
            break;
        case Pw.LOADMODE.STRETCH:
            instance.ctx.drawImage(img_obj, 0, 0, instance.w, instance.h);
            break;
        case Pw.LOADMODE.TILE:
            draw_t(0, 0);
            break;
        case Pw.LOADMODE.CENTER:
            instance.ctx.drawImage(img_obj, (instance.w - img_obj.width) / 2, (instance.h - img_obj.height) / 2);
            break;
        case Pw.LOADMODE.CENTERTILE:
        default:
            var calc = function(a, b) { return a > b ? - a % b : a - b; }
            draw_t(calc(instance.w, img_obj.width) / 2, calc(instance.h, img_obj.height) / 2);
    }
};

/***************
toolboxes
***************/

Pw.color = {};

/*
@param px an array of rgba, of one pixel
@param mode in Pw.BRIGHTNESS
@caution return value will be [0, 255]
*/
Pw.color.brightness = function(px, mode) {
    switch (mode) {
        case Pw.BRIGHTNESS.HSL:
            return (Math.max(px[0], px[1], px[2]) + Math.min(px[0], px[1], px[2])) / 2;
        case Pw.BRIGHTNESS.AVERAGE:
            return (px[0] + px[1] + px[2])/3;
        case Pw.BRIGHTNESS.CIE:
            return 0.2126*px[0] + 0.7152*px[1] + 0.0722*px[2];
        case Pw.BRIGHTNESS.HSV:
            return Math.max(px[0], px[1], px[2]);
        default:
            throw "No brightness scheme specified";
    }
}

Pw.mix = {};

/*
@param upper the upper pixel, in the array form
@param lower the lower pixel, in the array form
@param opacity the opacity of upper pixel
@param mode the mixture mode
*/
Pw.mix.mix = function(upper, lower, opacity, mode) {
    var ret = [];
    switch (mode) {
        case Pw.MIXMODE.REPLACE:
            for (var i = 0; i < 4; i++) {
                ret[i] = upper[i]*opacity + (1-opacity)*lower[i];
            }
            return ret;
        case Pw.MIXMODE.VIEW:
            var opa = opacity * upper[3] / 255;
            for (var i = 0; i < 3; i++) {
                ret[i] = upper[i]*opa + (1-opa)* lower[i];
            }
            ret[3] = (1-(1-opa)*(1-lower[3]/255))*255;
            return ret;
        default:
            throw "No such mix mode.";
    }
}

Pw.vector = {};

Pw.vector.addTo = function(vbase, vaddition) {
    if (vbase.length < vaddition.length) { throw "Illegal addition"; }
    for (var i = 0; i < vaddition.length; i++) {
        vbase[i] += vaddition[i];
    }
}

Pw.vector.mult = function(vbase, c) {
    ret = [];
    for (var i = 0; i < vbase.length; i++) {
        ret[i] = vbase[i] * c;
    }
    return ret;
}

Pw.vector.multBy = function(vbase, c) {
    for (var i = 0; i < vbase.length; i++) {
        vbase[i] *= c;
    }
}