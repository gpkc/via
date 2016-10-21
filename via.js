/*
  VGG Image Annotator (via)
  www.robots.ox.ac.uk/~vgg/software/via/
  
  Copyright (c) 2016, Abhishek Dutta.
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
  Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.
*/

var VIA_VERSION = "0.1b";
var VIA_REGION_SHAPE = { RECT:'rect',
                         CIRCLE:'circle',
                         ELLIPSE:'ellipse',
                         POLYGON:'polygon'};
var VIA_REGION_EDGE_TOL = 5;
var VIA_POLYGON_VERTEX_MATCH_TOL = 5;
var VIA_REGION_MIN_DIM = 5;
var VIA_ELLIPSE_EDGE_TOL = 0.2;
var VIA_THETA_TOL = Math.PI/18; // 10 degrees
var POLYGON_RESIZE_VERTEX_OFFSET = 100;

var VIA_THEME_REGION_BOUNDARY_WIDTH = 4;
var VIA_THEME_BOUNDARY_LINE_COLOR = "#1a1a1a";
var VIA_THEME_BOUNDARY_FILL_COLOR = "#aaeeff";
var VIA_THEME_SEL_REGION_FILL_COLOR = "#808080";
var VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR = "#000000";
var VIA_THEME_SEL_REGION_OPACITY = 0.5;
var VIA_THEME_MESSAGE_TIMEOUT_MS = 5000;
var VIA_THEME_ATTRIBUTE_IMG_WIDTH = 100;
var VIA_IMPORT_CSV_COMMENT_CHAR = '#';
var VIA_IMPORT_CSV_KEYVAL_SEP_CHAR = ';';
var VIA_EXPORT_CSV_ARRAY_SEP_CHAR = ':';
var VIA_CSV_SEP_CHAR = ',';

var _via_images = {};                // everything related to an image
var _via_images_count = 0;
var _via_canvas_regions = [];   // image regions spec. in canvas space
var _via_canvas_scale = 1.0;  // current scale of canvas image

var _via_image_id_list = [];         // array of image id (in original order)
var _via_image_id = '';              // id={filename+length} of current image
var _via_image_index = -1;           // index 

var _via_current_image_filename;
var _via_current_image;

// image canvas
var _via_canvas = document.getElementById("image_canvas");
var _via_ctx = _via_canvas.getContext("2d");
var _via_canvas_width, _via_canvas_height;

// state of the application
var _via_is_user_drawing_region = false;
var _via_current_image_loaded = false;
var is_window_resized = false;
var _via_is_user_resizing_region = false;
var _via_is_user_moving_region = false;
var _via_is_user_drawing_polygon = false;
var _via_is_region_selected = false;
var _via_is_user_updating_attribute_name = false;
var _via_is_user_updating_attribute_value = false;
var _via_is_user_adding_attribute_name = false;

// region
var _via_current_shape = VIA_REGION_SHAPE.RECT;
var _via_current_polygon_region_id = -1;
var _via_user_sel_region_id = -1;
var _via_click_x0 = 0; var _via_click_y0 = 0;
var _via_click_x1 = 0; var _via_click_y1 = 0;
var _via_region_edge = [-1, -1];
var _via_region_click_x, _via_region_click_y;
var _via_copied_image_regions = [];
var _via_copied_canvas_regions = [];

// message
var _via_message_clear_timer;

// attributes
var _via_region_attributes = new Set();
var _via_current_update_attribute_name = "";
var _via_current_update_region_id = -1;
var _via_region_attribute_param = new Map();

// persistence to local storage
var _via_is_local_storage_available = false;
var _via_is_save_ongoing = false;

// image list
var _via_reload_img_table = true;
var _via_loaded_img_table = [];
var _via_loaded_img_table_html = [];


// UI html elements
var invisible_file_input = document.getElementById("invisible_file_input");

var about_panel = document.getElementById("about_panel");
var via_start_info_panel = document.getElementById("via_start_info_panel");
var session_data_panel = document.getElementById("session_data_panel");
var message_panel = document.getElementById("message_panel");
var image_panel = document.getElementById("image_panel");
var navbar_panel = document.getElementById("navbar");
var info_panel = document.getElementById("info_panel");
var img_list_panel = document.getElementById("img_list_panel");

var annotation_list_snippet = document.getElementById("annotation_list_snippet");
var annotation_textarea = document.getElementById("annotation_textarea");    
var region_info_table = document.getElementById("region_info_table");


var zoom_active = false;
var ZOOM_SIZE_PERCENT = 0.2;
var zoom_size_img = -1;
var zoom_size_canvas = -1;
var ZOOM_BOUNDARY_COLOR = "#ffaaaa";

var COLOR_KEY = "#0000FF";
var COLOR_VALUE = "#000000";
var COLOR_MISSING_VALUE = "#FF0000";

var BBOX_LINE_WIDTH = 4;
var BBOX_BOUNDARY_FILL_COLOR_ANNOTATED = "#f2f2f2";
var BBOX_BOUNDARY_FILL_COLOR_NEW = "#aaeeff";
var BBOX_BOUNDARY_LINE_COLOR = "#1a1a1a";
var BBOX_SELECTED_FILL_COLOR = "#ffffff";
var BBOX_SELECTED_OPACITY = 0.3;

function ImageAttributes(fileref, filename, size) {
    this.filename = filename;
    this.size = size;
    this.fileref = fileref;
    this.file_attributes = new Map(); // image attributes
    this.base64_img_data = '';       // image data stored as base 64
    this.regions = [];
}

function ImageRegion() {
    this.is_user_selected = false;
    this.shape_attributes = new Map();  // region shape attributes
    this.region_attributes = new Map(); // region attributes
}

function clone_image_region(r0) {
    var r1 = new ImageRegion();
    r1.is_user_selected = r0.is_user_selected;

    // copy shape attributes
    for ( var[key,value] of r0.shape_attributes ) {
        r1.shape_attributes.set(key, value);
    }
    
    // copy region attributes
    for ( var[key,value] of r0.region_attributes ) {
        r1.region_attributes.set(key, value);
    }
    return r1;
}

function _via_get_image_id(filename, size) {
    return filename + size;
}

function main() {
    console.log("VGG Image Annotator (via)");
    show_message("VGG Image Annotator (via) version " + VIA_VERSION + ". Ready !");
    show_current_attributes();
    
    _via_is_local_storage_available = check_local_storage();

    //show_home_panel();   
    start_demo_session(); // defined in via_demo.js
    
    var data = `{
  "pic": {
    "type": "select_image",
    "image_url_list": [
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTQzMDEwNjUzNV5BMl5BanBnXkFtZTgwOTg2MzU0MzE@._V1_UY317_CR1,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMjE0MjAwOTMzMF5BMl5BanBnXkFtZTcwMDg1MjEyNw@@._V1_UY317_CR1,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTY0MzUwNzk0NF5BMl5BanBnXkFtZTYwNzM5NjEz._V1_UY317_CR14,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTgwNzE2OTQ3M15BMl5BanBnXkFtZTcwNTc0NTcxOA@@._V1_UX214_CR0,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTczOTA1NTQ4OF5BMl5BanBnXkFtZTcwMzU1NjkxOA@@._V1_UY317_CR22,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMjAwNjA5Nzg0Ml5BMl5BanBnXkFtZTgwMjQzNjUyODE@._V1_UY317_CR18,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTg2OTc0NzkzNF5BMl5BanBnXkFtZTgwMzE1NTYzNjE@._V1_UY317_CR51,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMjM1NzQ2MzE5NF5BMl5BanBnXkFtZTgwNzE3OTM2NjE@._V1_UY317_CR29,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTQ0Nzg4ODAyMF5BMl5BanBnXkFtZTgwNjkyNTQyMjE@._V1_UY317_CR20,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMjEwODQ5NTkwNF5BMl5BanBnXkFtZTgwMTM5NjE1NTE@._V1_UY317_CR104,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTU4NDkxMDQ4Nl5BMl5BanBnXkFtZTcwNTE2NDQwOA@@._V1_UY317_CR20,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMzMzOTUyOTc4NV5BMl5BanBnXkFtZTcwNTA5NzM5Mg@@._V1_UY317_CR26,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMjI4MjI0NzY2OF5BMl5BanBnXkFtZTcwNTIxMDAyOA@@._V1_UY317_CR1,0,214,317_AL_.jpg",
      "https://images-na.ssl-images-amazon.com/images/M/MV5BMTQyMjI0NjgwNF5BMl5BanBnXkFtZTcwODI0NTQwOA@@._V1_UX214_CR0,0,214,317_AL_.jpg"
    ],
    "image_value_list": [
      "Sherlock Holmes",
      "Dr. John Watson",
      "DI Lestrade",
      "Mrs. Hudson",
      "Molly Hooper",
      "Sgt Sally Donovan",
      "Ella",
      "Helen",
      "Margaret Patterson",
      "Mike Stamford",
      "Anderson",
      "Anthea",
      "Angelo",
      "Jeff"
    ]
  }
}`;
    import_region_attributes_from_json(data);
}

//
// Handlers for top navigation bar
//
function show_home_panel() {
    if (_via_current_image_loaded) {
        _via_canvas.style.display = "block";    
        via_start_info_panel.style.display = "none";
        about_panel.style.display = "none";
        session_data_panel.style.display = "none";
        img_list_panel.style.display = "none";

    } else {
        via_start_info_panel.style.display = "block";
        about_panel.style.display = "none";
        _via_canvas.style.display = "none";
        session_data_panel.style.display = "none";
        img_list_panel.style.display = "none";
    }
}
function load_images() {
    // source: https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
    if (invisible_file_input) {
        invisible_file_input.accept='image/*';
        invisible_file_input.onchange = upload_local_images;
        invisible_file_input.click();
    }
}
function download_all_region_data(type) {
    var all_region_data = package_region_data(type);
    var all_region_data_blob = new Blob(all_region_data, {type: 'text/'+type+';charset=utf-8'});
    if ( all_region_data_blob.size > (2*1024*1024) &&
         type == 'csv' ) {
        show_message('CSV file size is ' + (all_region_data_blob.size/(1024*1024)) + ' MB. We advise you to instead download as JSON');
    } else {
        save_data_to_local_file(all_region_data_blob, 'via_region_data.'+type);
    }
}

function upload_region_data_file() {
    if (invisible_file_input) {
        invisible_file_input.accept='text/csv, text/json, application/json';
        invisible_file_input.onchange = import_region_data_from_file;
        invisible_file_input.click();
    }

}
function save_attributes() {
    if ( _via_region_attributes.size > 0 ) {
	var attr_csvdata = [];
	for (var attribute of _via_region_attributes) {
	    attr_csvdata.push(attribute);
	}
	var attr_blob = new Blob([attr_csvdata.join(',')], {type: 'text/csv;charset=utf-8'});
	save_data_to_local_file(attr_blob, 'via_attributes_data.csv');
    } else {
	show_message("Attributes not defined yet!");
    }
}
function import_attributes() {
    if (_via_current_image_loaded) {
	if (invisible_file_input) {
            invisible_file_input.accept='text/csv, text/json, application/json';
            invisible_file_input.onchange = import_region_attributes_from_file;
            invisible_file_input.click();
	}
    } else {
	show_message("Please load some images first");
    }
}
function show_settings_panel() {
    show_message("Not implemented yet!");
}
function show_about_panel() {
    about_panel.style.display = "block";
    _via_canvas.style.display = "none";
    via_start_info_panel.style.display = "none";
    session_data_panel.style.display = "none";
}
function delete_all_attributes() {
    _via_region_attributes.clear();
    show_current_attributes();
    redraw__via_canvas();
}

//
// Local file uploaders
//
function upload_local_images(event) {
    var user_selected_images = event.target.files;
    var original_image_count = _via_images_count;
    for ( var i=0; i<user_selected_images.length; ++i) {
        var filename = user_selected_images[i].name;
        var size = user_selected_images[i].size;
        var img_id = _via_get_image_id(filename, size);

        if ( _via_images.hasOwnProperty(img_id) ) {
            if (_via_images[img_id].fileref) {
                show_message('Image ' + filename + ' already loaded. Skipping!');
            } else {
                _via_images[img_id].fileref = user_selected_images[i];
                show_message('Regions already exist for file ' + filename + ' !');              
            }
        } else {
            _via_images[img_id] = new ImageAttributes(user_selected_images[i], filename, size);
            _via_image_id_list.push(img_id);
            _via_images_count += 1;
            _via_reload_img_table = true;
        }
    }

    if ( _via_images ) {
        if (_via_image_index == -1) {
            show_image(0);
        } else {
            show_image( original_image_count );
        }
        show_message('Added ' + (_via_images_count - original_image_count) + 'images');
    } else {
        show_message("Please upload some image files!");
    }
}

//
// Data Importer
//

function import_region_attributes_from_file(event) {
    var selected_files = event.target.files;
    for (var file of selected_files) {
	console.log(file.type);
        switch(file.type) {
        case 'text/csv':
            load_text_file(file, import_region_attributes_from_csv);
            break;
        case 'text/json':
	case 'application/json':
            load_text_file(file, import_region_attributes_from_json);
            break;	    
        }
    }
}

function import_region_attributes_from_json(data) {
    var d = JSON.parse(data);
    var dattr_name = Object.getOwnPropertyNames(d);
    var attributes_import_count = 0;
    for (var attribute_name in d) {
	if ( !_via_region_attributes.has(attribute_name) ) {
	    _via_region_attributes.add(attribute_name);

	    if (d[attribute_name].hasOwnProperty('type')) {
		_via_region_attribute_param.set(attribute_name, new Map());
		for (var param in d[attribute_name]) {
		    _via_region_attribute_param.get(attribute_name).set(param,
									d[attribute_name][param]);
		}
	    } else {
		show_message('Ignoring missing "type" field in imported attribute name "' + attribute_name + '"');
	    }
	    attributes_import_count += 1;
	}
    }
    console.log(_via_region_attributes);
    console.log(_via_region_attribute_param);

    show_current_attributes();
    show_region_attributes_info();
    show_message('Imported ' + attributes_import_count + ' attributes from JSON file');
    save_current_data_to_browser_cache();

}

function import_region_attributes_from_csv(data) {
    if (data.includes(',')) {
	// contains just attribute names seperated by comma
	data = data.replace(/\n/g, ''); // discard newline \n
	var csvdata = data.split(',');
	var attributes_import_count = 0;
	for (var i=0; i<csvdata.length; ++i) {
	    var attribute_name = csvdata[i].trim();
	    
	    if ( !_via_region_attributes.has(attribute_name) ) {
		_via_region_attributes.add(attribute_name);
		attributes_import_count += 1;

		_via_region_attribute_type.set(attribute_name, new Map());
		_via_region_attribute_type.get(attribute_name).set('type', 'textarea');
	    }
	}
	_via_reload_img_table = true;
	show_current_attributes();
	show_region_attributes_info();
	show_message('Imported ' + attributes_import_count + ' attributes from CSV file');
	save_current_data_to_browser_cache();
    } else {
	show_message('CSV data has invalid format!', VIA_THEME_MESSAGE_TIMEOUT_MS);
	return;
    }
}

function import_region_data_from_file(event) {
    var selected_files = event.target.files;
    for (var file of selected_files) {
        switch(file.type) {
        case 'text/csv':
            load_text_file(file, import_region_data_from_csv);
            break;
        case 'text/json':
        case 'application/json':
            load_text_file(file, import_region_data_from_json);
            break;
        }
    }
}
function import_region_data_from_csv(data) {
    var csvdata = data.split('\n');
    var region_import_count = 0;
    var image_count = 0;
    for (var i=0; i<csvdata.length; ++i) {
        if (csvdata[i].charAt(0) == VIA_IMPORT_CSV_COMMENT_CHAR) {
            // parse header
            // #filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes
            var d = csvdata[i].substring(1, csvdata[i].length); // remove #
            d = d.split(',');
            var filename_index, size_index, file_attr_index, region_shape_attr_index
            for ( var j=0; j<d.length; ++j) {
                switch ( d[j] ) {
                case 'filename':
                    filename_index = j;
                    break;
                case 'file_size':
                    size_index = j;
                    break;
                case 'file_attributes':
                    file_attr_index = j;
                    break;
                case 'region_shape_attributes':
                    region_shape_attr_index = j;
                    break;
                case 'region_attributes':
                    region_attr_index = j;
                    break;
                }
            }
            continue;
        } else {
            var d = csvdata[i].split(',');
            
            var filename = d[filename_index];
            var size = d[size_index];
            var image_id = _via_get_image_id(filename, size);
            if ( _via_images.hasOwnProperty(image_id) ) {
                image_count += 1;
                
                // copy image attributes
                if ( d[file_attr_index] != '' ) {
                    var attr_map = keyval_str_to_map( d[file_attr_index] );
                    for( var [key, val] of attr_map ) {
                        _via_images[image_id].file_attributes.set(key, val);
                    }
                }

                var regioni = new ImageRegion();                
                // copy regions shape attributes
                if ( d[region_shape_attr_index] != '""' ||
                     d[region_shape_attr_index] != '' ) {                   
                    var region_str = d[region_shape_attr_index];
                    region_str = region_str.substring(1, region_str.length-1); // remove prefix and suffix quotation marks
                    
                    var attr_map = keyval_str_to_map( region_str );

                    for ( var [key, val] of attr_map ) {
                        if ( key == 'all_points_x' ||
                             key == 'all_points_y' ) {
                            val = val.substring(1, val.length-1); // discard the square brackets []
                            var valdata = val.split(VIA_EXPORT_CSV_ARRAY_SEP_CHAR);
                            var val_as_array = [];
                            for (var j=0; j<valdata.length; ++j) {
                                val_as_array.push( parseInt(valdata[j]) );
                            }
                            regioni.shape_attributes.set(key, val_as_array);
                        } else {
                            regioni.shape_attributes.set(key, val);
                        }
                    }
                }

                // copy region attributes
                if ( d[region_attr_index] != '""' ||
                     d[region_attr_index] != '' ) {                 
                    var region_attr = d[region_attr_index];
                    region_attr = region_attr.substring(1, region_attr.length-1); // remove prefix and suffix quotation marks
                    var region_attr_map = keyval_str_to_map( region_attr );
                    
                    for ( var [key, val] of region_attr_map ) {
                        regioni.region_attributes.set(key, val);

                        if (!_via_region_attributes.has(key)) {
                            _via_region_attributes.add(key);
			    _via_region_attribute_param.set(key, new Map());
			    _via_region_attribute_param.get(key).set('type', 'textarea');
                        }
                    }
                }               
                _via_images[image_id].regions.push(regioni);
                region_import_count += 1;
            } else {
                show_message('Skipping ' + image_id + ' as the corresponding image is not loaded');
            }
        }
    }
    show_message('Imported ' + region_import_count + ' regions for ' + image_count + ' images from CSV file');

    _via_reload_img_table = true;
    //_via_load_canvas_regions();
    show_image(_via_image_index);
    save_current_data_to_browser_cache();
}

function import_region_data_from_json(data) {
    var _via_images_as_json = JSON.parse(data);

    var image_count = 0;
    var region_import_count = 0;
    var skipped_file_attr_count = 0;
    for (image_id in _via_images_as_json) {
        if ( _via_images.hasOwnProperty(image_id) ) {
            image_count += 1;
            
            // copy image attributes
            for (var key in _via_images_as_json[image_id].file_attributes) {
                if (!_via_images[image_id].file_attributes.get(key)) {
                    _via_images[image_id].file_attributes.set(key, _via_images_as_json[image_id].file_attributes[key]);
                } else {
                    skipped_file_attr_count += 1;
                }
            }

            // copy regions
            var regions = _via_images_as_json[image_id].regions;
            for (var i in regions) {
                var regioni = new ImageRegion();
                for (var key in regions[i].shape_attributes) {
                    regioni.shape_attributes.set(key, regions[i].shape_attributes[key]);
                }
                for (var key in regions[i].region_attributes) {
                    regioni.region_attributes.set(key, regions[i].region_attributes[key]);

                    if (!_via_region_attributes.has(key)) {
                        _via_region_attributes.add(key);
                    }
                }
                _via_images[image_id].regions.push(regioni);
                region_import_count += 1;
            }
        } else {
            show_message('Skipping ' + image_id + ' as the corresponding image is not loaded');
        }
    }

    show_message('Imported ' + region_import_count + ' regions for ' + image_count + ' images from JSON file');

    _via_reload_img_table = true;
    //_via_load_canvas_regions();
    show_image(_via_image_index);
}

// key1=val1;key2=val2;...
function keyval_str_to_map(keyval_str) {
    var keyval_map = new Map();
    var d = keyval_str.split(VIA_IMPORT_CSV_KEYVAL_SEP_CHAR);    
    for (var i=0; i<d.length; ++i) {
        var keyval = d[i].split('=');
        if ( keyval.length == 2 ) {
            keyval_map.set(keyval[0], keyval[1]);
        } else {
            show_message('Skipping malformed values in the imported file');
        }
    }
    return keyval_map;
}

function load_text_file(text_file, callback_function) {
    if (!text_file) {
        return;
    } else {
        text_reader = new FileReader();
        text_reader.addEventListener( "progress", function(e) {
            show_message("Loading data from text file : " + text_file.name + " ... ");
        }, false);

        text_reader.addEventListener( "error", function() {
            show_message("Error loading data from text file :  " + text_file.name + " !");
            callback_function('');
        }, false);
        
        text_reader.addEventListener( "load", function() {
            callback_function(text_reader.result);
        }, false);
        text_reader.readAsText(text_file);
    }
}

//
// Data Exporter
//
function package_region_data(return_type) {
    if( return_type == "csv" ) {
        var csvdata = [];
        var csvheader = "#filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes";
        csvdata.push(csvheader);

        for ( var image_id in _via_images ) {
            var prefix_str = _via_images[image_id].filename;
            prefix_str += "," + _via_images[image_id].size;
            prefix_str += "," + attr_map_to_str( _via_images[image_id].file_attributes );

            var regions = _via_images[image_id].regions;
            
            for (var i=0; i<regions.length; ++i) {
                var region_shape_attr_str = regions.length + ',' + i + ',';
                region_shape_attr_str += attr_map_to_str( regions[i].shape_attributes );

                var region_attr_str = attr_map_to_str( regions[i].region_attributes );
                
                csvdata.push('\n' + prefix_str + ',' + region_shape_attr_str + ',' + region_attr_str);
            }
        }
        return csvdata;
    } else {
        // JSON.stringify() does not work with Map()
        // hence, we cast everything as objects
        var _via_images_as_obj = {};
        for (image_id in _via_images) {
            var image_data = {};
            image_data.fileref = _via_images[image_id].fileref;
            image_data.size = _via_images[image_id].size;
            image_data.filename = _via_images[image_id].filename;
            image_data.base64_img_data = _via_images[image_id].base64_img_data;
            
            // copy file attributes
            image_data.file_attributes = {};    
            for ( var [key, value] of _via_images[image_id].file_attributes ) {
                image_data.file_attributes[key] = value;
            }

            // copy all region shape_attributes
            image_data.regions = {};
            for (var i=0; i<_via_images[image_id].regions.length; ++i) {
                image_data.regions[i] = {};
                image_data.regions[i].shape_attributes = {};
                image_data.regions[i].region_attributes = {};
                // copy region shape_attributes
                for ( var [key, value] of _via_images[image_id].regions[i].shape_attributes) {
                    image_data.regions[i].shape_attributes[key] = value;
                }
                // copy region_attributes
                for ( var [key, value] of _via_images[image_id].regions[i].region_attributes) {
                    image_data.regions[i].region_attributes[key] = value;
                }
            }
            
            _via_images_as_obj[image_id] = image_data;
        }
        return [JSON.stringify(_via_images_as_obj)];
    }    
}

function attr_map_to_str(attr) {
    var attr_map_str = '"';
    for( var [key, value] of attr ) {
        if ( Array.isArray(value) ) {
            var value_str='[' + value[0];
            for (var i=1; i<value.length; ++i) {
                value_str += VIA_EXPORT_CSV_ARRAY_SEP_CHAR + value[i];
            }
            value_str += ']';
            attr_map_str = attr_map_str + key + '=' + value_str + ';';
        } else {
            attr_map_str = attr_map_str + key + '=' + value + ';';
        }
    }
    attr_map_str += '"';
    return attr_map_str;
}

function save_data_to_local_file(data, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(data);
    a.target = '_blank';
    a.download = filename;

    // simulate a mouse click event
    var event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    
    a.dispatchEvent(event);
}

//
// Setup Elements in User Interface
//
function show_image(image_index) {
    var img_id = _via_image_id_list[image_index]
    if (_via_images.hasOwnProperty(img_id)) {
        var img_filename = _via_images[img_id].filename;
        var img_reader = new FileReader();

        img_reader.addEventListener( "progress", function(e) {
	    show_message("Loading image " + img_filename + " ... ");
        }, false);

        img_reader.addEventListener( "error", function() {
	    show_message("Error loading image " + img_filename + " !");
        }, false);
        
        img_reader.addEventListener( "load", function() {
	    _via_current_image = new Image();
	    _via_current_image.addEventListener( "load", function() {
                _via_image_id = img_id;
                _via_image_index = image_index;
                _via_current_image_filename = img_filename;
                _via_current_image_loaded = true;
                
                // retrive image panel dim. to stretch _via_canvas to fit panel
                //main_content_width = 0.9*image_panel.offsetWidth;
                canvas_panel_width = document.documentElement.clientWidth - 250;
                canvas_panel_height = document.documentElement.clientHeight - 2.2*navbar_panel.offsetHeight;
                
                _via_canvas_width = _via_current_image.naturalWidth;
                _via_canvas_height = _via_current_image.naturalHeight;

                var scale_width, scale_height;
                if ( _via_canvas_width > canvas_panel_width ) {
		    // resize image to match the panel width
		    var scale_width = canvas_panel_width / _via_current_image.naturalWidth;
		    _via_canvas_width = canvas_panel_width;
		    _via_canvas_height = _via_current_image.naturalHeight * scale_width;
                }
                // resize image if its height is larger than the image panel
                if ( _via_canvas_height > canvas_panel_height ) {
		    var scale_height = canvas_panel_height / _via_canvas_height;
		    _via_canvas_height = canvas_panel_height;
		    _via_canvas_width = _via_canvas_width * scale_height;
                }

                _via_canvas_width = Math.round(_via_canvas_width);
                _via_canvas_height = Math.round(_via_canvas_height);
                _via_canvas_scale = _via_current_image.naturalWidth / _via_canvas_width;
                
                // set the canvas size to match that of the image
                _via_canvas.height = _via_canvas_height;
                _via_canvas.width = _via_canvas_width;
                //console.log("Canvas = " + _via_canvas.width + "," + _via_canvas.height);
                
                _via_click_x0 = 0; _via_click_y0 = 0;
                _via_click_x1 = 0; _via_click_y1 = 0;
                _via_is_user_drawing_region = false;
                is_window_resized = false;
                _via_is_user_resizing_region = false;
                _via_is_user_moving_region = false;
                _via_is_user_drawing_polygon = false;
                _via_is_region_selected = false;
                _via_user_sel_region_id = -1;
                
                clear_image_display_area();
                _via_canvas.style.display = "inline";

                _via_load_canvas_regions(); // image to canvas space transform
                _via_redraw_canvas();
                _via_canvas.focus();

                // update the info panel
                show_filename_info();
                show_region_attributes_info();
                show_region_shape_info();
                show_current_attributes();
                
                show_message("Loaded image " + img_filename + " ... ", 5000);
	    });
	    _via_current_image.src = img_reader.result;
        }, false);
	
	if (_via_images[img_id].base64_img_data == '') {
	    // load image from file
            img_reader.readAsDataURL( _via_images[img_id].fileref );
	} else {
	    // load image from bae64 data
	    img_reader.readAsText( new Blob([_via_images[img_id].base64_img_data]) );
	}
    }
}

// transform regions in image space to canvas space
function _via_load_canvas_regions() {
    // load all existing annotations into _via_canvas_regions
    var regions = _via_images[_via_image_id].regions;
    _via_canvas_regions  = [];
    for ( var i=0; i<regions.length; ++i) {
        var regioni = new ImageRegion();
        for ( var [key,value] of regions[i].shape_attributes ) {
            regioni.shape_attributes.set(key, value);
        }
        _via_canvas_regions.push(regioni);

        switch(_via_canvas_regions[i].shape_attributes.get('name')) {
        case VIA_REGION_SHAPE.RECT:
            var x = regions[i].shape_attributes.get('x') / _via_canvas_scale;
            var y = regions[i].shape_attributes.get('y') / _via_canvas_scale;
            var width = regions[i].shape_attributes.get('width') / _via_canvas_scale;
            var height = regions[i].shape_attributes.get('height') / _via_canvas_scale;
            
            _via_canvas_regions[i].shape_attributes.set('x', Math.round(x));
            _via_canvas_regions[i].shape_attributes.set('y', Math.round(y));
            _via_canvas_regions[i].shape_attributes.set('width', Math.round(width));
            _via_canvas_regions[i].shape_attributes.set('height', Math.round(height));
            break;
            
        case VIA_REGION_SHAPE.CIRCLE:
            var cx = _via_canvas_regions[i].shape_attributes.get('cx') / _via_canvas_scale;
            var cy = _via_canvas_regions[i].shape_attributes.get('cy') / _via_canvas_scale;
            var r = _via_canvas_regions[i].shape_attributes.get('r') / _via_canvas_scale;
            _via_canvas_regions[i].shape_attributes.set('cx', Math.round(cx));
            _via_canvas_regions[i].shape_attributes.set('cy', Math.round(cy));
            _via_canvas_regions[i].shape_attributes.set('r', Math.round(r));
            break;
            
        case VIA_REGION_SHAPE.ELLIPSE:
            var cx = _via_canvas_regions[i].shape_attributes.get('cx') / _via_canvas_scale;
            var cy = _via_canvas_regions[i].shape_attributes.get('cy') / _via_canvas_scale;
            var rx = _via_canvas_regions[i].shape_attributes.get('rx') / _via_canvas_scale;
            var ry = _via_canvas_regions[i].shape_attributes.get('ry') / _via_canvas_scale;
            _via_canvas_regions[i].shape_attributes.set('cx', Math.round(cx));
            _via_canvas_regions[i].shape_attributes.set('cy', Math.round(cy));
            _via_canvas_regions[i].shape_attributes.set('rx', Math.round(rx));
            _via_canvas_regions[i].shape_attributes.set('ry', Math.round(ry));
            break;
            
        case VIA_REGION_SHAPE.POLYGON:
            var all_points_x = _via_canvas_regions[i].shape_attributes.get('all_points_x').slice(0);
            var all_points_y = _via_canvas_regions[i].shape_attributes.get('all_points_y').slice(0);
            for (var j=0; j<all_points_x.length; ++j) {
                all_points_x[j] = Math.round(all_points_x[j] / _via_canvas_scale);
                all_points_y[j] = Math.round(all_points_y[j] / _via_canvas_scale);
            }
            _via_canvas_regions[i].shape_attributes.set('all_points_x', all_points_x);
            _via_canvas_regions[i].shape_attributes.set('all_points_y', all_points_y);
            break;
        }
    }
}

function clear_image_display_area() {
    _via_canvas.style.display = "none";
    about_panel.style.display = 'none';
    via_start_info_panel.style.display = 'none';
    session_data_panel.style.display = 'none';
    img_list_panel.style.display = 'none';
}

function delete_selected_regions() {
    var del_region_count = 0;
    for (var i=0; i<_via_canvas_regions.length; ++i) {
        if (_via_canvas_regions[i].is_user_selected) {
            _via_canvas_regions.splice(i, 1);
            _via_images[_via_image_id].regions.splice(i, 1);
            del_region_count += 1;
        }
    }

    _via_is_region_selected = false;    
    _via_user_sel_region_id = -1;
    _via_redraw_canvas();
    _via_canvas.focus();
    show_region_shape_info();
    show_current_attributes();

    show_message('Deleted ' + del_region_count + ' selected regions');

    save_current_data_to_browser_cache();
}

//
// UI Control Elements (buttons, etc)
//

// updates currently selected region shape
function select_region_shape(sel_shape_name) {
    for (var shape_name in VIA_REGION_SHAPE) {
        var ui_element = document.getElementById('region_shape_' + VIA_REGION_SHAPE[shape_name]);
        ui_element.classList.remove('region_shape_selected');
    }

    _via_current_shape = sel_shape_name;
    var ui_element = document.getElementById('region_shape_' + _via_current_shape);
    ui_element.classList.add('region_shape_selected');

    if ( _via_current_shape != VIA_REGION_SHAPE.POLYGON ) {
        _via_is_user_drawing_polygon = false;
        _via_current_polygon_region_id = -1;
	show_message('Press single click and drag mouse to draw ' + _via_current_shape + ' region', VIA_THEME_MESSAGE_TIMEOUT_MS);
    } else {
	show_message('Press single click to define polygon vertices. Note: in Polygon drawing mode, single click cannot be used to un-select regions');
    }
}

// enter annotation mode on double click
_via_canvas.addEventListener('dblclick', function(e) {
    show_message('Double clicks are not used in this application', VIA_THEME_MESSAGE_TIMEOUT_MS);
}, false);

// user clicks on the canvas
_via_canvas.addEventListener('mousedown', function(e) {
    _via_click_x0 = e.offsetX; _via_click_y0 = e.offsetY;
    _via_region_edge = is_on_region_corner(_via_click_x0, _via_click_y0);
    var region_id = is_inside_region(_via_click_x0, _via_click_y0);
    
    if ( _via_is_region_selected ) {
        // check if user clicked on the region boundary
        if ( _via_region_edge[1] > 0 ) {
            if ( !_via_is_user_resizing_region ) {
                // resize region
                if ( _via_region_edge[0] != _via_user_sel_region_id ) {
                    _via_user_sel_region_id = _via_region_edge[0];
                }
                _via_is_user_resizing_region = true;
            }
        } else {
            // check if user clicked inside a region
            if ( region_id == _via_user_sel_region_id ) {
                if( !_via_is_user_moving_region ) {     
                    _via_is_user_moving_region = true;
                    _via_region_click_x = _via_click_x0;
                    _via_region_click_y = _via_click_y0;
                }
            } else {
                if ( region_id == -1 ) {
                    // mousedown on outside any region
                    _via_is_user_drawing_region = true;
                    // unselect all regions
                    _via_is_region_selected = false;
                    _via_user_sel_region_id = -1;
                    toggle_all_regions_selection(false);
                }
            }
        }
    } else {
        if ( region_id == -1 ) {
            // mouse was clicked outside a region
            if (_via_current_shape != VIA_REGION_SHAPE.POLYGON) {
                // this is a bounding box drawing event
                _via_is_user_drawing_region = true;
            }
        }
    }
    e.preventDefault();
}, false);

// implements the following functionalities:
//  - new region drawing (including polygon)
//  - moving/resizing/select/unselect existing region
_via_canvas.addEventListener('mouseup', function(e) {
    _via_click_x1 = e.offsetX; _via_click_y1 = e.offsetY;

    var click_dx = Math.abs(_via_click_x1 - _via_click_x0);
    var click_dy = Math.abs(_via_click_y1 - _via_click_y0);

    // indicates that user has finished moving a region
    if ( _via_is_user_moving_region ) {
        _via_is_user_moving_region = false;
        _via_canvas.style.cursor = "default";

        var move_x = Math.round(_via_click_x1 - _via_region_click_x);
        var move_y = Math.round(_via_click_y1 - _via_region_click_y);

        // @todo: update the region data
        var image_attr = _via_images[_via_image_id].regions[_via_user_sel_region_id].shape_attributes;
        var canvas_attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;
        
        switch( canvas_attr.get('name') ) {
        case VIA_REGION_SHAPE.RECT:
            var xnew = image_attr.get('x') + Math.round(move_x * _via_canvas_scale);
            var ynew = image_attr.get('y') + Math.round(move_y * _via_canvas_scale);
            image_attr.set('x', xnew);
            image_attr.set('y', ynew);

            var canvas_xnew = canvas_attr.get('x') + move_x;
            var canvas_ynew = canvas_attr.get('y') + move_y;
            canvas_attr.set('x', canvas_xnew);
            canvas_attr.set('y', canvas_ynew);
            break;
        case VIA_REGION_SHAPE.CIRCLE:
        case VIA_REGION_SHAPE.ELLIPSE:
            var cxnew = image_attr.get('cx') + Math.round(move_x * _via_canvas_scale);
            var cynew = image_attr.get('cy') + Math.round(move_y * _via_canvas_scale);
            image_attr.set('cx', cxnew);
            image_attr.set('cy', cynew);

            var canvas_xnew = canvas_attr.get('cx') + move_x;
            var canvas_ynew = canvas_attr.get('cy') + move_y;
            canvas_attr.set('cx', canvas_xnew);
            canvas_attr.set('cy', canvas_ynew);     
            break;
        case VIA_REGION_SHAPE.POLYGON:
            var img_px = image_attr.get('all_points_x');
            var img_py = image_attr.get('all_points_y');
            for (var i=0; i<img_px.length; ++i) {
                img_px[i] = img_px[i] + Math.round(move_x * _via_canvas_scale);
                img_py[i] = img_py[i] + Math.round(move_y * _via_canvas_scale);
            }

            var canvas_px = canvas_attr.get('all_points_x');
            var canvas_py = canvas_attr.get('all_points_y');
            for (var i=0; i<canvas_px.length; ++i) {
                canvas_px[i] = canvas_px[i] + move_x;
                canvas_py[i] = canvas_py[i] + move_y;
            }
            break;
        }
        
        _via_redraw_canvas();
        _via_canvas.focus();
        save_current_data_to_browser_cache();
        return;
    }

    // indicates that user has finished resizing a region
    if ( _via_is_user_resizing_region ) {
        // _via_click(x0,y0) to _via_click(x1,y1)
        _via_is_user_resizing_region = false;
        _via_canvas.style.cursor = "default";
        
        // update the region
        var region_id = _via_region_edge[0];
        var image_attr = _via_images[_via_image_id].regions[region_id].shape_attributes;
        var canvas_attr = _via_canvas_regions[region_id].shape_attributes;
        
        switch (canvas_attr.get('name')) {
        case VIA_REGION_SHAPE.RECT:
            var x0 = canvas_attr.get('x');
            var y0 = canvas_attr.get('y');
            var x1 = x0 + canvas_attr.get('width');
            var y1 = y0 + canvas_attr.get('height');

            switch(_via_region_edge[1]) {
            case 1: // top-left
                x0 = _via_current_x;
                y0 = _via_current_y;
                break;
            case 3: // bottom-right
                x1 = _via_current_x;
                y1 = _via_current_y;
                break;
            case 2: // top-right
                x1 = _via_current_x;
                y0 = _via_current_y;
                break;
            case 4: // bottom-left
                x0 = _via_current_x;
                y1 = _via_current_y;
                break;
            }
            var w = Math.abs(x1-x0);
            var h = Math.abs(y1-y0);
            image_attr.set('x', Math.round(x0 * _via_canvas_scale));
            image_attr.set('y', Math.round(y0 * _via_canvas_scale));
            image_attr.set('width', Math.round(w * _via_canvas_scale));
            image_attr.set('height', Math.round(h * _via_canvas_scale));

            canvas_attr.set('x', x0);
            canvas_attr.set('y', y0);
            canvas_attr.set('width', w);
            canvas_attr.set('height', h);
            
            break;

        case VIA_REGION_SHAPE.CIRCLE:
            var dx = Math.abs(canvas_attr.get('cx') - _via_current_x);
            var dy = Math.abs(canvas_attr.get('cy') - _via_current_y);
            var new_r = Math.sqrt( dx*dx + dy*dy );

            canvas_attr.set('r', Math.round(new_r));
            image_attr.set('r', Math.round(new_r * _via_canvas_scale));
            break;

        case VIA_REGION_SHAPE.ELLIPSE:
            var new_rx = canvas_attr.get('rx');
            var new_ry = canvas_attr.get('ry');
            var dx = Math.abs(canvas_attr.get('cx') - _via_current_x);
            var dy = Math.abs(canvas_attr.get('cy') - _via_current_y);
            switch(_via_region_edge[1]) {
            case 5:
                new_ry = dy;
                break;
            case 6:
                new_rx = dx;
                break;
            default:
                new_rx = dx;
                new_ry = dy;
                break;
            }
            
            canvas_attr.set('rx', Math.round(new_rx));
            canvas_attr.set('ry', Math.round(new_ry));
            image_attr.set('rx', Math.round(new_rx * _via_canvas_scale));
            image_attr.set('ry', Math.round(new_ry * _via_canvas_scale));
            break;

        case VIA_REGION_SHAPE.POLYGON:
            var moved_vertex_id = _via_region_edge[1] - POLYGON_RESIZE_VERTEX_OFFSET;

            canvas_attr.get('all_points_x')[moved_vertex_id] = Math.round(_via_current_x);
            canvas_attr.get('all_points_y')[moved_vertex_id] = Math.round(_via_current_y);
            image_attr.get('all_points_x')[moved_vertex_id] = Math.round(_via_current_x * _via_canvas_scale);
            image_attr.get('all_points_y')[moved_vertex_id] = Math.round(_via_current_y * _via_canvas_scale);

            if (moved_vertex_id == 0) {
                // move both first and last vertex because we
                // the initial point at the end to close path
                var n = canvas_attr.get('all_points_x').length;
                canvas_attr.get('all_points_x')[n-1] = Math.round(_via_current_x);
                canvas_attr.get('all_points_y')[n-1] = Math.round(_via_current_y);
                image_attr.get('all_points_x')[n-1] = Math.round(_via_current_x * _via_canvas_scale);
                image_attr.get('all_points_y')[n-1] = Math.round(_via_current_y * _via_canvas_scale);
            }
            break;
        }

        _via_redraw_canvas();
        _via_canvas.focus();
        save_current_data_to_browser_cache();
        return;
    }
    
    // denotes a single click (= mouse down + mouse up)
    if ( click_dx < 5 ||
         click_dy < 5 ) {
        // if user is already drawing ploygon, then each click adds a new point
        if ( _via_is_user_drawing_polygon ) {
            var canvas_x0 = Math.round(_via_click_x0);
            var canvas_y0 = Math.round(_via_click_y0);
            
            // check if the clicked point is close to the first point
            var fx0 = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_x')[0];
            var fy0 = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_y')[0];
            var dx = (fx0 - canvas_x0);
            var dy = (fy0 - canvas_y0);
            if ( Math.sqrt(dx*dx + dy*dy) <= VIA_POLYGON_VERTEX_MATCH_TOL ) {
                // user clicked on the first polygon point to close the path
                _via_is_user_drawing_polygon = false;

                // add all polygon points stored in _via_canvas_regions[]
                var all_points_x = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_x').slice(0);
                var all_points_y = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_y').slice(0);
                var canvas_all_points_x = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_x');
                var canvas_all_points_y = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_y');

                // close path
                all_points_x.push(all_points_x[0]);
                all_points_y.push(all_points_y[0]);
                canvas_all_points_x.push(canvas_all_points_x[0]);
                canvas_all_points_y.push(canvas_all_points_y[0]);               
                
                var points_str = '';
                for ( var i=0; i<all_points_x.length; ++i) {
                    all_points_x[i] = Math.round( all_points_x[i] * _via_canvas_scale );
                    all_points_y[i] = Math.round( all_points_y[i] * _via_canvas_scale );
                    
                    points_str += all_points_x[i] + ' ' + all_points_y[i] + ',';
                }
                points_str = points_str.substring(0, points_str.length-1); // remove last comma
                
                var polygon_region = new ImageRegion();
                polygon_region.shape_attributes.set('name', 'polygon');
                //polygon_region.shape_attributes.set('points', points_str);
                polygon_region.shape_attributes.set('all_points_x', all_points_x);
                polygon_region.shape_attributes.set('all_points_y', all_points_y);
                _via_current_polygon_region_id = _via_images[_via_image_id].regions.length;
                _via_images[_via_image_id].regions.push(polygon_region);

                _via_current_polygon_region_id = -1;
                save_current_data_to_browser_cache();
            } else {
                // user clicked on a new polygon point
                _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_x').push(canvas_x0);
                _via_canvas_regions[_via_current_polygon_region_id].shape_attributes.get('all_points_y').push(canvas_y0);
            }
        } else {
            var region_id = is_inside_region(_via_click_x0, _via_click_y0);
            if ( region_id >= 0 ) {
                // first click selects region
                _via_user_sel_region_id = region_id;
                _via_is_region_selected = true;
                _via_is_user_moving_region = false;
                
                // de-select all other regions if the user has not pressed Shift
                if ( !e.shiftKey ) {
                    toggle_all_regions_selection(false);
                }
                _via_canvas_regions[region_id].is_user_selected = true;

                show_message('Region selected. Click and drag to move or resize the region', VIA_THEME_MESSAGE_TIMEOUT_MS);
                show_region_attributes_info();
                show_region_shape_info();
                show_current_attributes();
            } else {
                if ( _via_is_user_drawing_region ) {
                    // clear all region selection
                    _via_is_user_drawing_region = false;
                    toggle_all_regions_selection(false);
                    
                    show_region_attributes_info();
                    show_region_shape_info();
                    show_current_attributes();
                } else {
                    if (_via_current_shape == VIA_REGION_SHAPE.POLYGON) {
                        // user has clicked on the first point in a new polygon
                        _via_is_user_drawing_polygon = true;

                        var canvas_polygon_region = new ImageRegion();
                        canvas_polygon_region.shape_attributes.set('name', 'polygon');
                        canvas_polygon_region.shape_attributes.set('all_points_x', [Math.round(_via_click_x0)]);
                        canvas_polygon_region.shape_attributes.set('all_points_y', [Math.round(_via_click_y0)]);
                        _via_canvas_regions.push(canvas_polygon_region);
                        _via_current_polygon_region_id =_via_canvas_regions.length - 1;
                    }
                }
                
            }
        }
        _via_redraw_canvas();
        _via_canvas.focus();
        return;
    }

    // indicates that user has finished drawing a new region
    if (_via_is_user_drawing_region) {
        
        _via_is_user_drawing_region = false;
        
        var region_x0, region_y0, region_x1, region_y1;
        // ensure that (x0,y0) is top-left and (x1,y1) is bottom-right
        if ( _via_click_x0 < _via_click_x1 ) {
            region_x0 = _via_click_x0;
            region_x1 = _via_click_x1;
        } else {
            region_x0 = _via_click_x1;
            region_x1 = _via_click_x0;
        }

        if ( _via_click_y0 < _via_click_y1 ) {
            region_y0 = _via_click_y0;
            region_y1 = _via_click_y1;
        } else {
            region_y0 = _via_click_y1;
            region_y1 = _via_click_y0;
        }

        var original_img_region = new ImageRegion();
        var canvas_img_region = new ImageRegion();
        var region_dx = Math.abs(region_x1 - region_x0);
        var region_dy = Math.abs(region_y1 - region_y0);

        if ( region_dx > VIA_REGION_MIN_DIM ||
             region_dy > VIA_REGION_MIN_DIM ) { // avoid regions with 0 dim
                switch(_via_current_shape) {
                case VIA_REGION_SHAPE.RECT:
                    original_img_region.shape_attributes.set('name', 'rect');
                    original_img_region.shape_attributes.set('x', Math.round(region_x0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('y', Math.round(region_y0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('width', Math.round(region_dx * _via_canvas_scale));
                    original_img_region.shape_attributes.set('height', Math.round(region_dy * _via_canvas_scale));

                    canvas_img_region.shape_attributes.set('name', 'rect');
                    canvas_img_region.shape_attributes.set('x', Math.round(region_x0));
                    canvas_img_region.shape_attributes.set('y', Math.round(region_y0));
                    canvas_img_region.shape_attributes.set('width', Math.round(region_dx));
                    canvas_img_region.shape_attributes.set('height', Math.round(region_dy));

                    _via_images[_via_image_id].regions.push(original_img_region);
                    _via_canvas_regions.push(canvas_img_region);

                    break;
                case VIA_REGION_SHAPE.CIRCLE:
                    var circle_radius = Math.round(Math.sqrt( region_dx*region_dx + region_dy*region_dy ));
                    original_img_region.shape_attributes.set('name', 'circle');
                    original_img_region.shape_attributes.set('cx', Math.round(region_x0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('cy', Math.round(region_y0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('r', Math.round(circle_radius * _via_canvas_scale));

                    canvas_img_region.shape_attributes.set('name', 'circle');
                    canvas_img_region.shape_attributes.set('cx', Math.round(region_x0));
                    canvas_img_region.shape_attributes.set('cy', Math.round(region_y0));
                    canvas_img_region.shape_attributes.set('r', Math.round(circle_radius));

                    _via_images[_via_image_id].regions.push(original_img_region);
                    _via_canvas_regions.push(canvas_img_region);

                    break;
                case VIA_REGION_SHAPE.ELLIPSE:
                    original_img_region.shape_attributes.set('name', 'ellipse');
                    original_img_region.shape_attributes.set('cx', Math.round(region_x0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('cy', Math.round(region_y0 * _via_canvas_scale));
                    original_img_region.shape_attributes.set('rx', Math.round(region_dx * _via_canvas_scale));
                    original_img_region.shape_attributes.set('ry', Math.round(region_dy * _via_canvas_scale));

                    canvas_img_region.shape_attributes.set('name', 'ellipse');
                    canvas_img_region.shape_attributes.set('cx', Math.round(region_x0));
                    canvas_img_region.shape_attributes.set('cy', Math.round(region_y0));
                    canvas_img_region.shape_attributes.set('rx', Math.round(region_dx));
                    canvas_img_region.shape_attributes.set('ry', Math.round(region_dy));

                    _via_images[_via_image_id].regions.push(original_img_region);
                    _via_canvas_regions.push(canvas_img_region);

                    break;
                case VIA_REGION_SHAPE.POLYGON:
                    // handled by _via_is_user_drawing polygon
                    break;
                }
        } else {
            show_message('Skipped adding a ' + _via_current_shape + ' of nearly 0 dimension', VIA_THEME_MESSAGE_TIMEOUT_MS);
        }
        _via_redraw_canvas();
        _via_canvas.focus();
        save_current_data_to_browser_cache();
        return;
    }
    
});

function toggle_all_regions_selection(is_selected=false) {
    for (var i=0; i<_via_canvas_regions.length; ++i) {
        _via_canvas_regions[i].is_user_selected = is_selected;
    }
}

_via_canvas.addEventListener("mouseover", function(e) {
    // change the mouse cursor icon
    _via_redraw_canvas();
    _via_canvas.focus();
});

_via_canvas.addEventListener('mousemove', function(e) {
    if ( !_via_current_image_loaded ) {
        return;
    }
    
    _via_current_x = e.offsetX; _via_current_y = e.offsetY;

    if ( _via_is_region_selected ) {
        if ( !_via_is_user_resizing_region ) {
            // check if user moved mouse cursor to region boundary
            // which indicates an intention to resize the reigon
            
            _via_region_edge = is_on_region_corner(_via_current_x, _via_current_y);

            if ( _via_region_edge[0] == _via_user_sel_region_id ) {
                switch(_via_region_edge[1]) {
                    // rect
                case 1: // top-left corner of rect
                case 3: // bottom-right corner of rect
                    _via_canvas.style.cursor = "nwse-resize";
                    break;
                case 2: // top-right corner of rect
                case 4: // bottom-left corner of rect
                    _via_canvas.style.cursor = "nesw-resize";
                    break;
                    
                    // circle and ellipse
                case 5:
                    _via_canvas.style.cursor = "n-resize";
                    break;
                case 6:
                    _via_canvas.style.cursor = "e-resize";
                    break;

                default:
                    _via_canvas.style.cursor = "default";
                }

                if (_via_region_edge[1] >= POLYGON_RESIZE_VERTEX_OFFSET) {
                    // indicates mouse over polygon vertex
                    _via_canvas.style.cursor = "crosshair";
                }
            } else {
                var region_id = is_inside_region(_via_current_x, _via_current_y);
                if ( region_id == _via_user_sel_region_id ) {
                    _via_canvas.style.cursor = "move";
                } else {
                    _via_canvas.style.cursor = "default";
                }
            }
        }
    }
    
    if(_via_is_user_drawing_region) {
        // draw rectangle as the user drags the mouse cousor
        _via_redraw_canvas(); // clear old intermediate rectangle

        var region_x0, region_y0;

        if ( _via_click_x0 < _via_current_x ) {
            if ( _via_click_y0 < _via_current_y ) {
                region_x0 = _via_click_x0;
                region_y0 = _via_click_y0;
            } else {
                region_x0 = _via_click_x0;
                region_y0 = _via_current_y;
            }
        } else {
            if ( _via_click_y0 < _via_current_y ) {
                region_x0 = _via_current_x;
                region_y0 = _via_click_y0;
            } else {
                region_x0 = _via_current_x;
                region_y0 = _via_current_y;
            }
        }
        var dx = Math.round(Math.abs(_via_current_x - _via_click_x0));
        var dy = Math.round(Math.abs(_via_current_y - _via_click_y0));

        switch (_via_current_shape ) {
        case VIA_REGION_SHAPE.RECT:
            _via_draw_rect_region(region_x0,
                                  region_y0,
                                  dx,
                                  dy);
            break;
        case VIA_REGION_SHAPE.CIRCLE:
            var circle_radius = Math.round(Math.sqrt( dx*dx + dy*dy ));
            _via_draw_circle_region(region_x0,
                                    region_y0,
                                    circle_radius);
            break;
        case VIA_REGION_SHAPE.ELLIPSE:
            _via_draw_ellipse_region(region_x0,
                                     region_y0,
                                     dx,
                                     dy);
            break;
        case VIA_REGION_SHAPE.POLYGON:
            // this is handled by the if ( _via_is_user_drawing_polygon ) { ... }
            // see below
            break;
        }
        _via_canvas.focus();
    }
    
    if ( _via_is_user_resizing_region ) {
        // user has clicked mouse on bounding box edge and is now moving it
        _via_redraw_canvas(); // clear old intermediate rectangle

        var region_id = _via_region_edge[0];
        var attr = _via_canvas_regions[region_id].shape_attributes;
        switch (attr.get('name')) {
        case VIA_REGION_SHAPE.RECT:
            var x0 = _via_canvas_regions[region_id].shape_attributes.get('x');
            var y0 = _via_canvas_regions[region_id].shape_attributes.get('y');
            var x1 = x0 + _via_canvas_regions[region_id].shape_attributes.get('width');
            var y1 = y0 + _via_canvas_regions[region_id].shape_attributes.get('height');

            switch(_via_region_edge[1]) {
            case 1: // top-left
                x0 = _via_current_x;
                y0 = _via_current_y;
                break;
            case 3: // bottom-right
                x1 = _via_current_x;
                y1 = _via_current_y;
                break;
            case 2: // top-right
                x1 = _via_current_x;
                y0 = _via_current_y;
                break;
            case 4: // bottom-left
                x0 = _via_current_x;
                y1 = _via_current_y;
                break;
            }
            _via_draw_rect_region(x0,
                                  y0,
                                  Math.abs(x1-x0),
                                  Math.abs(y1-y0),
                                  true);
            break;

        case VIA_REGION_SHAPE.CIRCLE:
            var dx = Math.abs(attr.get('cx') - _via_current_x);
            var dy = Math.abs(attr.get('cy') - _via_current_y);
            var new_r = Math.sqrt( dx*dx + dy*dy );
            _via_draw_circle_region(attr.get('cx'),
                                    attr.get('cy'),
                                    new_r,
                                    true);
            break;

        case VIA_REGION_SHAPE.ELLIPSE:
            var new_rx = attr.get('rx');
            var new_ry = attr.get('ry');
            var dx = Math.abs(attr.get('cx') - _via_current_x);
            var dy = Math.abs(attr.get('cy') - _via_current_y);
            switch(_via_region_edge[1]) {
            case 5:
                new_ry = dy;
                break;
            case 6:
                new_rx = dx;
                break;
            default:
                new_rx = dx;
                new_ry = dy;
                break;
            }
            _via_draw_ellipse_region(attr.get('cx'),
                                     attr.get('cy'),
                                     new_rx,
                                     new_ry,
                                     true);
            break;

        case VIA_REGION_SHAPE.POLYGON:
            var moved_all_points_x = attr.get('all_points_x').slice(0);
            var moved_all_points_y = attr.get('all_points_y').slice(0);     
            var moved_vertex_id = _via_region_edge[1] - POLYGON_RESIZE_VERTEX_OFFSET;

            moved_all_points_x[moved_vertex_id] = _via_current_x;
            moved_all_points_y[moved_vertex_id] = _via_current_y;

            if (moved_vertex_id == 0) {
                // move both first and last vertex because we
                // the initial point at the end to close path
                moved_all_points_x[moved_all_points_x.length-1] = _via_current_x;
                moved_all_points_y[moved_all_points_y.length-1] = _via_current_y;
            }

            _via_draw_polygon_region(moved_all_points_x,
                                     moved_all_points_y,
                                     true);
            break;
        }
        _via_canvas.focus();
    }

    if ( _via_is_user_moving_region ) {
        _via_redraw_canvas();
        
        var move_x = (_via_current_x - _via_region_click_x);
        var move_y = (_via_current_y - _via_region_click_y);
        var attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;

        switch (attr.get('name')) {
        case VIA_REGION_SHAPE.RECT:
            _via_draw_rect_region(attr.get('x') + move_x,
                                  attr.get('y') + move_y,
                                  attr.get('width'),
                                  attr.get('height'),
                                  true);
            break;

        case VIA_REGION_SHAPE.CIRCLE:
            _via_draw_circle_region(attr.get('cx') + move_x,
                                    attr.get('cy') + move_y,
                                    attr.get('r'),
                                    true);
            break;

        case VIA_REGION_SHAPE.ELLIPSE:
            _via_draw_ellipse_region(attr.get('cx') + move_x,
                                     attr.get('cy') + move_y,
                                     attr.get('rx'),
                                     attr.get('ry'),
                                     true);
            break;

        case VIA_REGION_SHAPE.POLYGON:
            var moved_all_points_x = attr.get('all_points_x').slice(0);
            var moved_all_points_y = attr.get('all_points_y').slice(0);
            for (var i=0; i<moved_all_points_x.length; ++i) {
                moved_all_points_x[i] += move_x;
                moved_all_points_y[i] += move_y;
            }
            _via_draw_polygon_region(moved_all_points_x,
                                     moved_all_points_y,
                                     true);
            break;
        }
        _via_canvas.focus();    
    }

    if ( _via_is_user_drawing_polygon ) {
        _via_redraw_canvas();
        var attr = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes;
        var all_points_x = attr.get('all_points_x');
        var all_points_y = attr.get('all_points_y');
        var npts = all_points_x.length;

        var line_x = [all_points_x.slice(npts-1), _via_current_x];
        var line_y = [all_points_y.slice(npts-1), _via_current_y];
        _via_draw_polygon_region(line_x, line_y, false);
    }
    
    //console.log("_via_is_user_drawing_region=" + _via_is_user_drawing_region + ", _via_is_user_resizing_region=" + _via_is_user_resizing_region + ", _via_region_edge=" + _via_region_edge[0] + "," + _via_region_edge[1]);
    
    /* @todo: implement settings -> show guide
       else {
       redraw__via_canvas();
       _via_current_x = e.offsetX; _via_current_y = e.offsetY;
       _via_ctx.strokeStyle="#ffffff";
       _via_ctx.setLineDash([0]);
       _via_ctx.strokeRect(0, _via_current_y, canvas_width, 1);
       _via_ctx.strokeRect(_via_current_x, 0, 1, canvas_height);
       _via_canvas.focus();
       }
    */
});

// @todo: implement hierarchial clustering to better visualize file list
function show_img_list() {
    if (_via_images_count > 0) {
        img_list_panel.style.display = 'block';
        via_start_info_panel.style.display = "none";
        about_panel.style.display = "none";
        _via_canvas.style.display = "none";
        session_data_panel.style.display = "none";

        _via_user_sel_region_id = -1;
        _via_is_region_selected = false;
        
        show_region_attributes_info();
        show_region_shape_info();
        show_current_attributes();

        if ( _via_reload_img_table ) {
            _via_loaded_img_table = [];
            
            for (var i=0; i<_via_images_count; ++i) {
                img_id = _via_image_id_list[i];
                var file_entry = {};
                file_entry.image_index = i;
                file_entry.filename = _via_images[img_id].filename;
                file_entry.missing_attr_val_count = count_missing_attribute_value(img_id);
                _via_loaded_img_table.push(file_entry);
            }
            
            _via_loaded_img_table.sort( function (a, b) {
                return a.filename.localeCompare(b.filename);
            });
            
            _via_loaded_img_table_html = [];
            var fni = '';
            _via_loaded_img_table_html.push('<p>Showing list of currently loaded images. Click on an entry to open the file</p>');
            _via_loaded_img_table_html.push('<ul>');
            for (var i=0; i<_via_loaded_img_table.length; ++i) {
                fni = '<li onclick="show_image(' + _via_loaded_img_table[i].image_index + ')">';
                //fni += '[' + _via_loaded_img_table[i].image_index + '] ';
                fni += _via_loaded_img_table[i].filename;
                if (_via_loaded_img_table[i].missing_attr_val_count) {
                    fni += '<span style="color: red;"> (missing ' + _via_loaded_img_table[i].missing_attr_val_count + ' attributes value)</span>';
                }
                _via_loaded_img_table_html.push(fni);
            }
            _via_loaded_img_table_html.push('</ul>');
            _via_reload_img_table = false;
        }
        img_list_panel.innerHTML = _via_loaded_img_table_html.join('');
    } else {
        show_message("Please load some images first!", VIA_THEME_MESSAGE_TIMEOUT_MS);
    }
}

function count_missing_attribute_value(img_id) {
    var missing_attribute_count = 0;
    for( var i=0; i<_via_images[img_id].regions.length; ++i) {
        missing_attribute_count += _via_region_attributes.size - _via_images[img_id].regions[i].region_attributes.size;
    }
    return missing_attribute_count;
}

//
// Canvas update routines
//

function _via_redraw_canvas() {
    if (_via_current_image_loaded) {
        _via_ctx.drawImage(_via_current_image, 0, 0, _via_canvas_width, _via_canvas_height);
        draw_all_regions();
        draw_all_region_id();
    }
}

function draw_all_regions() {
    for (var i=0; i < _via_canvas_regions.length; ++i) {
        var attr = _via_canvas_regions[i].shape_attributes;
        var is_selected = _via_canvas_regions[i].is_user_selected;
        
        switch( attr.get('name') ) {
        case VIA_REGION_SHAPE.RECT:
            _via_draw_rect_region(attr.get('x'),
                                  attr.get('y'),
                                  attr.get('width'),
                                  attr.get('height'),
                                  is_selected);
            break;
        case VIA_REGION_SHAPE.CIRCLE:
            _via_draw_circle_region(attr.get('cx'),
                                    attr.get('cy'),
                                    attr.get('r'),
                                    is_selected);
            break;
        case VIA_REGION_SHAPE.ELLIPSE:
            _via_draw_ellipse_region(attr.get('cx'),
                                     attr.get('cy'),
                                     attr.get('rx'),
                                     attr.get('ry'),
                                     is_selected);
            break;
        case VIA_REGION_SHAPE.POLYGON:
            _via_draw_polygon_region(attr.get('all_points_x'),
                                     attr.get('all_points_y'),
                                     is_selected);
            break;
        }
    }
}

function _via_draw_rect_region(x, y, w, h, is_selected) {
    if (is_selected) {
        _via_draw_rect(x, y, w, h);
        
        _via_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_ctx.stroke();

        _via_ctx.fillStyle = VIA_THEME_SEL_REGION_FILL_COLOR;
        _via_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
        _via_ctx.fill();
        _via_ctx.globalAlpha = 1.0;
    } else {
        // draw a fill line
        _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_draw_rect(x, y, w, h);
        _via_ctx.stroke();

        if ( w > VIA_THEME_REGION_BOUNDARY_WIDTH &&
             h > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
            // draw a boundary line on both sides of the fill line
            _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
            _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
            _via_draw_rect(x - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                           y - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                           w + VIA_THEME_REGION_BOUNDARY_WIDTH,
                           h + VIA_THEME_REGION_BOUNDARY_WIDTH);
            _via_ctx.stroke();

            _via_draw_rect(x + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                           y + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                           w - VIA_THEME_REGION_BOUNDARY_WIDTH,
                           h - VIA_THEME_REGION_BOUNDARY_WIDTH);
            _via_ctx.stroke();
        }
    }
}

function _via_draw_rect(x, y, w, h) {
    _via_ctx.beginPath();
    _via_ctx.moveTo(x  , y);
    _via_ctx.lineTo(x+w, y);
    _via_ctx.lineTo(x+w, y+h);
    _via_ctx.lineTo(x  , y+h);
    _via_ctx.closePath();
}

function _via_draw_circle_region(cx, cy, r, is_selected) {
    if (is_selected) {
        _via_draw_circle(cx, cy, r);
        
        _via_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_ctx.stroke();

        _via_ctx.fillStyle = VIA_THEME_SEL_REGION_FILL_COLOR;
        _via_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
        _via_ctx.fill();
        _via_ctx.globalAlpha = 1.0;
    } else {
        // draw a fill line
        _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_draw_circle(cx, cy, r);
        _via_ctx.stroke();

        if ( r > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
            // draw a boundary line on both sides of the fill line
            _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
            _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
            _via_draw_circle(cx,
                             cy,
                             r - VIA_THEME_REGION_BOUNDARY_WIDTH/2);
            _via_ctx.stroke();
            _via_draw_circle(cx,
                             cy,
                             r + VIA_THEME_REGION_BOUNDARY_WIDTH/2);
            _via_ctx.stroke();
        }
    }
}

function _via_draw_circle(cx, cy, r) {
    _via_ctx.beginPath();
    _via_ctx.arc(cx, cy, r, 0, 2*Math.PI, false);
    _via_ctx.closePath();
}

function _via_draw_ellipse_region(cx, cy, rx, ry, is_selected) {
    if (is_selected) {
        _via_draw_ellipse(cx, cy, rx, ry);
        
        _via_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_ctx.stroke();

        _via_ctx.fillStyle = VIA_THEME_SEL_REGION_FILL_COLOR;
        _via_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
        _via_ctx.fill();
        _via_ctx.globalAlpha = 1.0;
    } else {
        // draw a fill line
        _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_draw_ellipse(cx, cy, rx, ry);
        _via_ctx.stroke();

        if ( rx > VIA_THEME_REGION_BOUNDARY_WIDTH &&
             ry > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
            // draw a boundary line on both sides of the fill line
            _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
            _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
            _via_draw_ellipse(cx,
                              cy,
                              rx + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                              ry + VIA_THEME_REGION_BOUNDARY_WIDTH/2);
            _via_ctx.stroke();
            _via_draw_ellipse(cx,
                              cy,
                              rx - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                              ry - VIA_THEME_REGION_BOUNDARY_WIDTH/2);
            _via_ctx.stroke();  
        }
    }
}

function _via_draw_ellipse(cx, cy, rx, ry) {
    _via_ctx.save();
    
    _via_ctx.beginPath();
    _via_ctx.translate(cx-rx, cy-ry);
    _via_ctx.scale(rx, ry);
    _via_ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);

    _via_ctx.restore(); // restore to original state
    _via_ctx.closePath();

}

function _via_draw_polygon_region(all_points_x, all_points_y, is_selected) {
    if (is_selected) {  
        _via_ctx.beginPath();
        _via_ctx.moveTo(all_points_x[0], all_points_y[0]);      
        for (var i=1; i<all_points_x.length; ++i) {
            _via_ctx.lineTo(all_points_x[i], all_points_y[i]);
        }
        _via_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
        _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
        _via_ctx.stroke();

        _via_ctx.fillStyle = VIA_THEME_SEL_REGION_FILL_COLOR;
        _via_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
        _via_ctx.fill();
        _via_ctx.globalAlpha = 1.0;
    } else {
        for (var i=1; i<all_points_x.length; ++i) {
            // draw a fill line
            _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
            _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
            _via_ctx.beginPath();
            _via_ctx.moveTo(all_points_x[i-1], all_points_y[i-1]);
            _via_ctx.lineTo(all_points_x[i], all_points_y[i]);
            _via_ctx.stroke();

            var slope_i = (all_points_y[i] - all_points_y[i-1]) / (all_points_x[i] - all_points_x[i-1]);
            if (slope_i > 0) {
                // draw a boundary line on both sides
                _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
                _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
                _via_ctx.beginPath();
                _via_ctx.moveTo(parseInt(all_points_x[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.lineTo(parseInt(all_points_x[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.stroke();
                _via_ctx.beginPath();
                _via_ctx.moveTo(parseInt(all_points_x[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.lineTo(parseInt(all_points_x[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.stroke();
            } else {
                // draw a boundary line on both sides
                _via_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
                _via_ctx.lineWidth = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
                _via_ctx.beginPath();
                _via_ctx.moveTo(parseInt(all_points_x[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.lineTo(parseInt(all_points_x[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.stroke();
                _via_ctx.beginPath();
                _via_ctx.moveTo(parseInt(all_points_x[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.lineTo(parseInt(all_points_x[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                                parseInt(all_points_y[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
                _via_ctx.stroke();
            }
        }
    }
}

function draw_all_region_id() { 
    _via_ctx.shadowColor = "transparent";
    for (var i=0; i < _via_images[_via_image_id].regions.length; ++i) {
        var annotation_str = (i+1);

        var bbox = get_canvas_region_bounding_box(i);

        var x = bbox[0];
        var y = bbox[1];
        var w = Math.abs(bbox[2] - bbox[0]);
        var h = Math.abs(bbox[3] - bbox[1]);
        _via_ctx.font = '12pt Sans';

        var spc_dot = _via_ctx.measureText('.').width
        var bgnd_rect_height = 1.8 * _via_ctx.measureText('M').width;
        var bgnd_rect_width = _via_ctx.measureText(annotation_str).width * 2;

        // first, draw a background rectangle first
        _via_ctx.fillStyle = 'black';
        _via_ctx.globalAlpha=0.8;
        _via_ctx.fillRect(x,
                          y,
                          bgnd_rect_width,
                          bgnd_rect_height);
        
        // then, draw text over this background rectangle
        _via_ctx.globalAlpha=1.0;
        _via_ctx.fillStyle = 'yellow';
        _via_ctx.fillText(annotation_str, x+spc_dot, y+3.8*spc_dot);

    }
}

function get_canvas_region_bounding_box(region_id) {
    var bbox = new Array(4);
    var d = _via_canvas_regions[region_id].shape_attributes;
    switch( d.get('name') ) {
    case 'rect':
        bbox[0] = d.get('x');
        bbox[1] = d.get('y');
        bbox[2] = d.get('x') + d.get('width');
        bbox[3] = d.get('y') + d.get('height');;
        break;
        
    case 'circle':
        bbox[0] = d.get('cx') - d.get('r');
        bbox[1] = d.get('cy') - d.get('r');
        bbox[2] = d.get('cx') + d.get('r');
        bbox[3] = d.get('cy') + d.get('r');
        break;
        
    case 'ellipse':
        bbox[0] = d.get('cx') - d.get('rx');
        bbox[1] = d.get('cy') - d.get('ry');
        bbox[2] = d.get('cx') + d.get('rx');
        bbox[3] = d.get('cy') + d.get('ry');
        break;
        
    case 'polygon':
        var all_points_x = d.get('all_points_x');
        var all_points_y = d.get('all_points_y');

        var minx=Number.MAX_SAFE_INTEGER;
        var miny=Number.MAX_SAFE_INTEGER;
        var maxx=0;
        var maxy=0;
        for (var i=0; i<all_points_x.length; ++i) {
            if (all_points_x[i] < minx) {
                minx = all_points_x[i];
            }
            if (all_points_x[i] > maxx) {
                maxx = all_points_x[i];
            }
            if (all_points_y[i] < miny) {
                miny = all_points_y[i];
            }
            if (all_points_y[i] > maxy) {
                maxy = all_points_y[i];
            }
        }
        bbox[0] = minx;
        bbox[1] = miny;
        bbox[2] = maxx;
        bbox[3] = maxy;

        // place the region id box at any random vertex
        bbox[0] = all_points_x[0];
        bbox[1] = all_points_y[0];
        break;  
    }
    return bbox;
}

//
// Region collision routines
//
function is_inside_region(px, py) {
    for (var i=0; i < _via_canvas_regions.length; ++i) {
        var attr = _via_canvas_regions[i].shape_attributes;
        var result = false;
        
        switch ( attr.get('name') ) {
        case VIA_REGION_SHAPE.RECT:
            result = is_inside_rect(attr.get('x'),
                                    attr.get('y'),
                                    attr.get('width'),
                                    attr.get('height'),
                                    px, py);
            break;
        case VIA_REGION_SHAPE.CIRCLE:
            result = is_inside_circle(attr.get('cx'),
                                      attr.get('cy'),
                                      attr.get('r'),
                                      px, py);
            break;

        case VIA_REGION_SHAPE.ELLIPSE:
            result = is_inside_ellipse(attr.get('cx'),
                                       attr.get('cy'),
                                       attr.get('rx'),
                                       attr.get('ry'),
                                       px, py);
            break;

        case VIA_REGION_SHAPE.POLYGON:      
            result = is_inside_polygon(attr.get('all_points_x'),
                                       attr.get('all_points_y'),
                                       px, py);
            break;
        }

        if (result) {
            return i;
        }
    }    
    return -1;
}

function is_inside_circle(cx, cy, r, px, py) {
    var dx = px - cx;
    var dy = py - cy;
    if ((dx*dx + dy*dy) < r*r ) {
        return true;
    } else {
        return false;
    }
}

function is_inside_rect(x, y, w, h, px, py) {
    if ( px > x &&
         px < (x+w) &&
         py > y &&
         py < (y+h) ) {
        return true;
    } else {
        return false;
    }
}

function is_inside_ellipse(cx, cy, rx, ry, px, py) {
    var dx = (cx - px);
    var dy = (cy - py);
    if ( (((dx*dx)/(rx*rx)) + ((dy*dy)/(ry*ry))) < 1 ) {
        return true;
    } else {
        return false;
    }
}

// returns 0 when (px,py) is outside the polygon
// source: http://geomalgorithms.com/a03-_inclusion.html
function is_inside_polygon(all_points_x, all_points_y, px, py) {
    var wn = 0;    // the  winding number counter
    
    // loop through all edges of the polygon
    for (var i=0; i<all_points_x.length-1; ++i) {   // edge from V[i] to  V[i+1]
        var is_left_value = is_left( all_points_x[i], all_points_y[i],
                                     all_points_x[i+1], all_points_y[i+1],
                                     px, py);

        if (all_points_y[i] <= py) {
            if (all_points_y[i+1]  > py &&
                is_left_value > 0) {
                ++wn;
            }
        }
        else {
            if (all_points_y[i+1]  <= py &&
                is_left_value < 0) {
                --wn;
            }
        }
    }
    if ( wn == 0 ) {
        return 0;
    }
    else {
        return 1;
    }
}

// returns
// >0 if (x2,y2) lies on the left side of line joining (x0,y0) and (x1,y1)
// =0 if (x2,y2) lies on the line joining (x0,y0) and (x1,y1)
// >0 if (x2,y2) lies on the right side of line joining (x0,y0) and (x1,y1)
// source: http://geomalgorithms.com/a03-_inclusion.html
function is_left(x0, y0, x1, y1, x2, y2) {
    return ( ((x1 - x0) * (y2 - y0))  - ((x2 -  x0) * (y1 - y0)) );
}

function is_on_region_corner(px, py) {
    var _via_region_edge = [-1, -1]; // region_id, corner_id [top-left=1,top-right=2,bottom-right=3,bottom-left=4]
    
    for (var i=0; i < _via_canvas_regions.length; ++i) {
        var attr = _via_canvas_regions[i].shape_attributes;
        var result = false;
        _via_region_edge[0] = i;
        
        switch ( attr.get('name') ) {
        case VIA_REGION_SHAPE.RECT:
            result = is_on_rect_edge(attr.get('x'),
                                     attr.get('y'),
                                     attr.get('width'),
                                     attr.get('height'),
                                     px, py);
            break;
        case VIA_REGION_SHAPE.CIRCLE:
            result = is_on_circle_edge(attr.get('cx'),
                                       attr.get('cy'),
                                       attr.get('r'),
                                       px, py);
            break;

        case VIA_REGION_SHAPE.ELLIPSE:
            result = is_on_ellipse_edge(attr.get('cx'),
                                        attr.get('cy'),
                                        attr.get('rx'),
                                        attr.get('ry'),
                                        px, py);
            break;

        case VIA_REGION_SHAPE.POLYGON:      
            result = is_on_polygon_vertex(attr.get('all_points_x'),
                                          attr.get('all_points_y'),
                                          px, py);
            break;
        }

        if (result > 0) {
            _via_region_edge[1] = result;
            return _via_region_edge;
        }
    }
    _via_region_edge[0] = -1;
    return _via_region_edge;
}

function is_on_rect_edge(x, y, w, h, px, py) {
    var dx0 = Math.abs(x - px);
    var dy0 = Math.abs(y - py);
    var dx1 = Math.abs(x + w - px);
    var dy1 = Math.abs(y + h - py);

    //[top-left=1,top-right=2,bottom-right=3,bottom-left=4]
    if ( dx0 < VIA_REGION_EDGE_TOL &&
         dy0 < VIA_REGION_EDGE_TOL ) {
        return 1;
    }
    if ( dx1 < VIA_REGION_EDGE_TOL &&
         dy0 < VIA_REGION_EDGE_TOL ) {
        return 2;
    }
    if ( dx1 < VIA_REGION_EDGE_TOL &&
         dy1 < VIA_REGION_EDGE_TOL ) {
        return 3;
    }

    if ( dx0 < VIA_REGION_EDGE_TOL &&
         dy1 < VIA_REGION_EDGE_TOL ) {
        return 4;
    }
    return 0;
}

function is_on_circle_edge(cx, cy, r, px, py) {
    var dx = cx - px;
    var dy = cy - py;
    if ( Math.abs(Math.sqrt( dx*dx + dy*dy ) - r) < VIA_REGION_EDGE_TOL ) {
        var theta = Math.atan2( py - cy, px - cx );
        if ( Math.abs(theta - (Math.PI/2)) < VIA_THETA_TOL ||
             Math.abs(theta + (Math.PI/2)) < VIA_THETA_TOL) {
            return 5;
        }
        if ( Math.abs(theta) < VIA_THETA_TOL ||
             Math.abs(Math.abs(theta) - Math.PI) < VIA_THETA_TOL) {
            return 6;
        }
        
        if ( theta >0 && theta < (Math.PI/2) ) {
            return 1;
        }
        if ( theta > (Math.PI/2) && theta < (Math.PI) ) {
            return 4;
        }
        if ( theta <0 && theta > -(Math.PI/2) ) {
            return 2;
        }
        if ( theta < -(Math.PI/2) && theta > -Math.PI ) {
            return 3;
        }
    } else {
        return 0;
    }
}

function is_on_ellipse_edge(cx, cy, rx, ry, px, py) {
    var dx = (cx - px)/rx;
    var dy = (cy - py)/ry;

    if ( Math.abs(Math.sqrt( dx*dx + dy*dy ) - 1) < VIA_ELLIPSE_EDGE_TOL ) {
        var theta = Math.atan2( py - cy, px - cx );
        if ( Math.abs(theta - (Math.PI/2)) < VIA_THETA_TOL ||
             Math.abs(theta + (Math.PI/2)) < VIA_THETA_TOL) {
            return 5;
        }
        if ( Math.abs(theta) < VIA_THETA_TOL ||
             Math.abs(Math.abs(theta) - Math.PI) < VIA_THETA_TOL) {
            return 6;
        }
        
        if ( theta >0 && theta < (Math.PI/2) ) {
            return 1;
        }
        if ( theta > (Math.PI/2) && theta < (Math.PI) ) {
            return 4;
        }
        if ( theta <0 && theta > -(Math.PI/2) ) {
            return 2;
        }
        if ( theta < -(Math.PI/2) && theta > -Math.PI ) {
            return 3;
        }
    } else {
        return 0;
    }
}

function is_on_polygon_vertex(all_points_x, all_points_y, px, py) {
    var n = all_points_x.length;
    for (var i=0; i<n; ++i) {
        if ( Math.abs(all_points_x[i] - px) < VIA_POLYGON_VERTEX_MATCH_TOL &&
             Math.abs(all_points_y[i] - py) < VIA_POLYGON_VERTEX_MATCH_TOL ) {
            /*
            // match found
            var x0,x1,x2;
            var y0,y1,y2;
            if ( i==0 ) {
            x2 = all_points_x[1]; y2 = all_points_y[1];
            x1 = all_points_x[0]; y1 = all_points_y[0];
            x0 = all_points_x[n-2]; y0 = all_points_y[n-2];
            } else {
            if ( i==(n-1) ) {
            x2 = all_points_x[0]; y2 = all_points_y[0];
            x1 = all_points_x[n-1]; y1 = all_points_y[n-1];
            x0 = all_points_x[n-2]; y0 = all_points_y[n-2];
            } else {
            x2 = all_points_x[i+1]; y2 = all_points_y[i+1];
            x1 = all_points_x[i]; y1 = all_points_y[i];
            x0 = all_points_x[i-1]; y0 = all_points_y[i-1];
            }
            }
            */      
            return (POLYGON_RESIZE_VERTEX_OFFSET+i);
        }
    }
    return 0;
}

function update_ui_components() {
    if ( !is_window_resized && _via_current_image_loaded ) {
        show_message("Resizing window ...", VIA_THEME_MESSAGE_TIMEOUT_MS);
        is_window_resized = true;
        show_image(_via_image_index);
    }
}


window.addEventListener("keydown", function(e) {
    // user commands
    if ( e.ctrlKey ) {
        if ( e.which == 83 ) { // Ctrl + s
            download_all_region_data('csv');
            e.preventDefault();
            return;
        }

        if ( e.which == 73 ) { // Ctrl + i
            upload_region_data_file();
            e.preventDefault();
            return;
        }

        if ( e.which == 79 ) { // Ctrl + o
            load_images();
            e.preventDefault();
            return;
        }

        if ( e.which == 65 ) { // Ctrl + a
            for (var i=0; i<_via_canvas_regions.length; ++i) {
                _via_canvas_regions[i].is_user_selected = true;
            }
            _via_is_region_selected = true;
            _via_redraw_canvas();
            show_current_attributes();
            e.preventDefault();
            return;
        }
        
        if ( e.which == 76 ) { // Ctrl + l
            show_img_list();
            e.preventDefault();
            return;
        }

        if ( e.which == 67 ) { // Ctrl + c
            _via_copied_image_regions.splice(0);
            _via_copied_canvas_regions.splice(0);
            for (var i=0; i<_via_images[_via_image_id].regions.length; ++i) {
                var img_region = _via_images[_via_image_id].regions[i];
                var canvas_region = _via_canvas_regions[i];
                if (canvas_region.is_user_selected) {
                    _via_copied_image_regions.push( clone_image_region(img_region) );
                    _via_copied_canvas_regions.push( clone_image_region(canvas_region) );
                }
            }
            show_message('Copied ' + _via_copied_image_regions.length + ' selected regions. Press Ctrl + v to paste', VIA_THEME_MESSAGE_TIMEOUT_MS);
            e.preventDefault();
            return;
        }

        if ( e.which == 86 ) { // Ctrl + v
            for (var i=0; i<_via_copied_image_regions.length; ++i) {
                _via_images[_via_image_id].regions.push( _via_copied_image_regions[i] );
                _via_canvas_regions.push( _via_copied_canvas_regions[i] );
            }
            show_message('Pasted ' + _via_copied_image_regions.length + ' regions', VIA_THEME_MESSAGE_TIMEOUT_MS);
            e.preventDefault();
            _via_redraw_canvas();
            return;
        }
    }

    if ( (e.altKey || e.metaKey) ) {
        if( e.which == 68 ) { // Alt + d
            delete_selected_regions();
            e.preventDefault();
        }
    }
    
    
    if ( e.which == 13 ) { // Enter
        if (_via_is_user_updating_attribute_value ||
            _via_is_user_updating_attribute_name) {
            save_attribute_value();
            e.preventDefault();
            return;
        }

        if (_via_is_user_adding_attribute_name) {
            save_new_attribute_name();
            e.preventDefault();
            return;
        }
    }
    
    if ( e.which == 27 ) { // Esc
        if (_via_is_user_updating_attribute_value ||
            _via_is_user_updating_attribute_name) {
            cancel_attribute_update();
        }

        if (_via_is_user_adding_attribute_name) {
            cancel_attribute_add();
        }
        
        if ( _via_is_user_resizing_region ) {
            // cancel region resizing action
            _via_is_user_resizing_region = false;
        }
        
        if ( _via_is_region_selected ) {
            // clear all region selections
            _via_is_region_selected = false;
            _via_user_sel_region_id = -1;
            for (var i=0; i < _via_images[_via_image_id].regions.length; ++i) {
                _via_images[_via_image_id].regions[i].is_user_selected = false;
                _via_canvas_regions[i].is_user_selected = false;
            }
        }

        if ( zoom_active ) {
            zoom_active=false;
        }

        if ( _via_is_user_drawing_polygon ) {
            _via_is_user_drawing_polygon = false;
            _via_canvas_regions.splice(_via_current_polygon_region_id, 1);
        }

        if ( _via_is_user_drawing_region ) {
            _via_is_user_drawing_region = false;
        }

        if ( _via_is_user_resizing_region ) {
            _via_is_user_resizing_region = false
        }

        if ( _via_is_user_updating_attribute_name ||
             _via_is_user_updating_attribute_value) {
            _via_is_user_updating_attribute_name = false;
            _via_is_user_updating_attribute_value = false;
            _via_current_update_attribute_name = "";

            show_current_attributes();
            show_region_attributes_info();
        }

        if ( _via_is_user_moving_region ) {
            _via_is_user_moving_region = false
        }
        
        e.preventDefault();
        _via_redraw_canvas();
    }

    if (e.which == 78 || e.which == 39) { // n or right arrow
        if (!_via_is_user_updating_attribute_value &&
            !_via_is_user_updating_attribute_name &&
            !_via_is_user_adding_attribute_name) {
            move_to_next_image();
            e.preventDefault();
        }
        return;
    }
    if (e.which == 80 || e.which == 37) { // n or right arrow
        if (!_via_is_user_updating_attribute_value &&
            !_via_is_user_updating_attribute_name &&
            !_via_is_user_adding_attribute_name) {
            move_to_prev_image();
            e.preventDefault();
        }
        return;
    }

    if ( e.which == 121 ) { // F10 key used for debugging
        print_current_state_vars();
        e.preventDefault();
        //print_current_image_data();
    }
    if (e.which == 113) { // F2 for about
        show_about_panel();
        e.preventDefault();
    }
    
    if ( e.which == 90 ) { // z used to toggle zoom
        if ( zoom_active ) {
            zoom_active=false;
        } else {
            zoom_active=true;
        }
        redraw__via_canvas();
    }    
});

function move_to_prev_image() {
    if (_via_images_count > 0) {
        _via_is_region_selected = false;
        _via_user_sel_region_id = -1;
        
        _via_current_sel_region_id = -1;
        
        _via_canvas.style.display = "none";
        _via_ctx.clearRect(0, 0, _via_canvas.width, _via_canvas.height);

        if ( _via_image_index == 0 ) {   
            show_image(_via_images_count - 1);
        } else {
            show_image(_via_image_index - 1);
        }
    }    
}

function move_to_next_image() {
    if (_via_images_count > 0) {
        _via_is_region_selected = false;
        _via_user_sel_region_id = -1;

        _via_current_sel_region_id = -1;
        
        _via_canvas.style.display = "none";
        _via_ctx.clearRect(0, 0, _via_canvas.width, _via_canvas.height);

        if ( _via_image_index == (_via_images_count-1) ) {   
            show_image(0);
        } else {
            show_image(_via_image_index + 1);
        }
    }
}

//
// Update of user interface elements
// Communication from javascript to UI
//
function show_message(msg, timeout_ms) {
    if ( _via_message_clear_timer ) {
        clearTimeout(_via_message_clear_timer); // stop any previous timeouts
    }
    
    message_panel.innerHTML = msg;

    if ( timeout_ms != undefined ) {
        _via_message_clear_timer = setTimeout( function() {
            message_panel.innerHTML = ' ';
        }, timeout_ms);
    }
    
    
}

function show_all_info() {
    show_filename_info();
    show_region_info();
    show_annotation_info();
    show_current_attributes();
}

function show_region_attributes_info() {
    if ( _via_user_sel_region_id != -1 ) {
        var region_set_attr_count = _via_images[_via_image_id].regions[_via_user_sel_region_id].region_attributes.size;
        var region_attr_count = _via_region_attributes.size;

        var missing_attr_count = region_attr_count - region_set_attr_count;
        if (missing_attr_count) {
            document.getElementById("info_attribute").innerHTML = region_set_attr_count + ' ( ' + (region_attr_count - region_set_attr_count) + ' remaining )';
        } else {
            document.getElementById("info_attribute").innerHTML = region_set_attr_count;
        }
    } else {
        document.getElementById("info_attribute").innerHTML = "";
    }
}

function show_region_shape_info() {
    if ( _via_current_image_loaded ) {
        document.getElementById("info_region").innerHTML = _via_images[_via_image_id].regions.length;
    } else {
        document.getElementById("info_region").innerHTML = "";
    }
}

function show_filename_info() {
    if ( _via_current_image_loaded ) {
        document.getElementById("info_current_filename").innerHTML = _via_current_image_filename;
        document.getElementById("info_current_fileid").innerHTML = (_via_image_index+1) + " of " + _via_images_count;
    } else {
        document.getElementById("info_current_filename").innerHTML = "";
        document.getElementById("info_current_fileid").innerHTML = "";
    }
}

//
// attributes
//
function show_current_attributes() {
    if ( _via_current_image_loaded ) {
        var region_info = [];

        var theader = '<tr><th></th>';
        if (_via_is_region_selected) {
            var regions = _via_images[_via_image_id].regions;
            for (var i=0; i<regions.length; ++i) {
                if (_via_canvas_regions[i].is_user_selected) {
                    theader += '<th>Region [' + (i+1) + ']</th>';
                }
            }
        }
        theader += '</tr>';
        region_info.push(theader);

        for (var attribute of _via_region_attributes) {
	    region_info.push('<tr>');
	    region_info.push('<td class="header_cell" title="' + attribute + '">' + attribute + '</td>');

	    var regions = _via_images[_via_image_id].regions;
	    for (var i=0; i<regions.length; ++i) {
                if (_via_canvas_regions[i].is_user_selected) {
		    var click_handler = 'update_attribute_value(\'' + i +'\', \'' + attribute + '\')';
		    if (regions[i].region_attributes.has(attribute)) {
			var attr_val = regions[i].region_attributes.get(attribute);
			var param = _via_region_attribute_param.get(attribute);

			switch(param.get('type')) {
			case 'select_image':
			    if (_via_region_attributes.size == 1) {
				
			    } else {
				var pic_index = param.get('image_value_list').indexOf(attr_val);
				var pic_url = param.get('image_url_list')[pic_index];
				var pic_attr = '<div><img src="' + pic_url + '"><p>' + attr_val + '</p></div>';
				region_info.push('<td class="clickable_tbl_entry" title="' + attr_val + '" onclick="' + click_handler + '">' + pic_attr + '</td>');
			    }
			    break;
			default:
			    
                            region_info.push('<td class="clickable_tbl_entry" title="' + attr_val + '" onclick="' + click_handler + '">' + attr_val + '</td>');
			}
		    } else {
                        region_info.push('<td title="' + attr_val + '" onclick="' + click_handler + '">' + '<span class="action_text_link">[click to set value]</span>' + '</td>');
		    }
                }
	    }

	    region_info.push('</tr>');
        }
        region_info_table.innerHTML = region_info.join('');
    } else {
        region_info_table.innerHTML = '<tr><td><span class="action_text_link" onclick="add_attribute_name()">[Add]</span> attributes or <span class="action_text_link" onclick="import_attributes()">[Import]</span> from a file</td></tr>';
    }
}

function add_attribute_name() {
    if ( _via_current_image_loaded ) {
	_via_is_user_adding_attribute_name = true;
	
	var region_info = [];    
	region_info.push('<tr><td colspan="2">New attribute name</td></tr>');
	region_info.push('<tr><td colspan="2"><textarea id="textarea_attribute_name" rows="8" cols="40"></textarea></td></tr>');
	region_info.push('<tr><td><button type="button" onclick="save_new_attribute_name()">Save</button> (or Enter)</td>');
	region_info.push('<td><button type="button" onclick="cancel_attribute_add()">Cancel</button> (or Esc)</td></tr>');

	region_info_table.innerHTML = region_info.join('');
	
	document.getElementById("textarea_attribute_name").focus();
	document.getElementById("textarea_attribute_name").onkeypress = function(e) {
            if ( e.key == VIA_IMPORT_CSV_COMMENT_CHAR ||
		 e.key == VIA_IMPORT_CSV_KEYVAL_SEP_CHAR ||
		 e.key == VIA_EXPORT_CSV_ARRAY_SEP_CHAR ||
		 e.key == VIA_CSV_SEP_CHAR ||
		 e.key == '~') {
		show_message('Some special characters (, : ; #) are not allowed', VIA_THEME_MESSAGE_TIMEOUT_MS);
		e.preventDefault();
            }
	};
    } else {
	show_message("Please load some images first", VIA_THEME_MESSAGE_TIMEOUT_MS);
    }
}
function save_new_attribute_name() {
    var new_attr_name = document.getElementById("textarea_attribute_name").value;
    if (_via_region_attributes.has(new_attr_name)) {
        show_message('"' + new_attr_name + '" attribute name already exists', VIA_THEME_MESSAGE_TIMEOUT_MS);
    } else {
        _via_region_attributes.add(new_attr_name);
        show_message('"' + new_attr_name + '" attribute name added', VIA_THEME_MESSAGE_TIMEOUT_MS);
    }

    _via_is_user_adding_attribute_name = false;
    show_current_attributes();
    show_region_attributes_info();
}

function cancel_attribute_add() {
    _via_is_user_adding_attribute_name = false;
    show_current_attributes();
    show_region_attributes_info();
}

function cancel_attribute_update() {
    is_user_updating_attribute_name = false;
    current_update_attribute_name = "";
    show_current_attributes();
    show_region_attributes_info();
}

function update_attribute_value(region_id, attribute) {
    _via_is_user_updating_attribute_value = true;
    _via_current_update_attribute_name = attribute;
    _via_current_update_region_id = region_id;

    var region = _via_images[_via_image_id].regions[_via_current_update_region_id];
    var cur_attr_val = region.region_attributes.get(attribute);
    if ( !cur_attr_val ) {
        cur_attr_val = '';
    }
    
    var region_info = [];
    var param = _via_region_attribute_param.get(attribute);

    switch (param.get('type')) {
    case 'select_image':
	region_info.push('<tr><td>');
	for (var i=0; i<param.get('image_url_list').length; ++i) {
	    var imgblock = '<div style="display: inline-block; padding:1em;">';
	    imgblock += '<input type="image" src="' + param.get('image_url_list')[i] + '"' +
		' width="' + VIA_THEME_ATTRIBUTE_IMG_WIDTH + '"' + 
		' alt="' + param.get('image_value_list')[i] + '"' +
		' onclick="save_attribute_value(\'' + param.get('image_value_list')[i] + '\')">';
	    imgblock += '<p>' + param.get('image_value_list')[i] + '</p>';
	    imgblock += '</div>';
	    console.log(imgblock);
	    region_info.push(imgblock);
	}
	region_info.push('</td></tr>');
	region_info_table.innerHTML = region_info.join('');
	break;
	
    default:
	region_info.push('<tr><td colspan="2">' + attribute + '</td></tr>');
	region_info.push('<tr><td colspan="2"><textarea id="textarea_attribute_value" rows="8" cols="40">' + cur_attr_val + '</textarea></td></tr>');
	region_info.push('<tr><td><button type="button" onclick="save_attribute_value()">Save</button> (or Enter)</td>');
	region_info.push('<td><button type="button" onclick="cancel_attribute_update()">Cancel</button> (or Esc)</td></tr>');

	region_info_table.innerHTML = region_info.join('');
	
	document.getElementById("textarea_attribute_value").focus();
	document.getElementById("textarea_attribute_value").onkeypress = function(e) {
            if ( e.key == VIA_IMPORT_CSV_COMMENT_CHAR ||
		 e.key == VIA_IMPORT_CSV_KEYVAL_SEP_CHAR ||
		 e.key == VIA_EXPORT_CSV_ARRAY_SEP_CHAR ||
		 e.key == VIA_CSV_SEP_CHAR ||
		 e.key == '~') {
		show_message('Some special characters (, : ; #) are not allowed', VIA_THEME_MESSAGE_TIMEOUT_MS);
		e.preventDefault();
            }
	};
    }
}

function save_attribute_value(attribute_value) {
    var param = _via_region_attribute_param.get(_via_current_update_attribute_name);
    var new_attribute_value = '';
    switch(param.get('type')) {
    case 'select_image':
	new_attribute_value = attribute_value;
	break;
    default:
	new_attribute_value = document.getElementById("textarea_attribute_value").value;
    }

    var img_region_attr = _via_images[_via_image_id].regions[_via_current_update_region_id].region_attributes;
    
    img_region_attr.set(_via_current_update_attribute_name, new_attribute_value);
    
    _via_is_user_updating_attribute_value = false;
    _via_current_update_attribute_name = "";
    _via_current_update_region_id = -1;

    show_current_attributes();
    show_region_attributes_info();

    setTimeout(function() {
        save_current_data_to_browser_cache();
    }, 1000);
}

//
// Persistence of annotation data in localStorage
//

function check_local_storage() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    try {
        var x = '__storage_test__';
        localStorage.setItem(x, x);
        localStorage.removeItem(x);
        return true;
    }
    catch(e) {
        return false;
    }
}

function save_current_data_to_browser_cache() {
    setTimeout(function() {
        if ( _via_is_local_storage_available &&
             ! _via_is_save_ongoing) {
            try {
                _via_is_save_ongoing = true;
                localStorage.setItem('_via_timestamp', Date.now());
                localStorage.setItem('_via_images', package_region_data('json'));

                // save attributes
                var attr = [];
                for (var attribute of _via_region_attributes) {
                    attr.push(attribute);
                }
                localStorage.setItem('_via_region_attributes', JSON.stringify(attr));
                _via_is_save_ongoing = false;
            } catch(err) {
                _via_is_save_ongoing = false;
                show_message('Failed to save data to browser cache');
                console.log('Failed to save data to browser cache');
                console.log(err.message);
            }
        }
    }, 1000);
}

//
// used for debugging
//
function print_current_state_vars() {
    console.log('\n_via_is_user_drawing_region'+_via_is_user_drawing_region+
                '\n_via_current_image_loaded'+_via_current_image_loaded+
                '\nis_window_resized'+is_window_resized+
                '\n_via_is_user_resizing_region'+_via_is_user_resizing_region+
                '\n_via_is_user_moving_region'+_via_is_user_moving_region+
                '\n_via_is_user_drawing_polygon'+_via_is_user_drawing_polygon+
                '\n_via_is_region_selected'+_via_is_region_selected);
}

function print_current_image_data() {
    for ( var image_id in _via_images) {
        var fn = _via_images[image_id].filename;
        var logstr = "[" + fn + "] : ";

        var img_regions = _via_images[image_id].regions;
        for ( var i=0; i<img_regions.length; ++i) {
            var attr = img_regions[i].shape_attributes;
            var img_region_str = '\n\t_via_images[i].regions.shape_attributes = [';
            for ( var [key, value] of attr ) {
                img_region_str += key + ':' + value + ';';
            }
            logstr += img_region_str + ']';

            var attr = img_regions[i].region_attributes;
            var img_region_str = '\n\t_via_images[i].regions.region_attributes = [';
            for ( var [key, value] of attr ) {
                img_region_str += key + ':' + value + ';';
            }
            logstr += img_region_str + ']';         
        }

        if ( _via_image_id == image_id ) {
            for ( var i=0; i<_via_canvas_regions.length; ++i) {
                var canvas_region_str = '\n\t_via_canvas_regions = [';
                for ( var [key, value] of _via_canvas_regions[i].shape_attributes ) {
                    canvas_region_str += key + ':' + value + ';';
                }
                logstr += canvas_region_str + ']';
            }
        }
        console.log(logstr);
    }
}
