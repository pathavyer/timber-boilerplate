'use strict';

// DIR CONFIG

const config = {
  dirs: {
    generated: './scss/autogenerated/',
    assets: './img/',
    scripts: './js/',
    styles: './scss/',
  },
  // Standalone JS libraries to copy on build
  js_libs_paths: [
    // './node_modules/slick-carousel/slick/slick.min.js'
  ]
};


// DEPENDENCIES
// all require'd variables are to be prefixed with an underscore to ease debugging and cleaning up

// const debug               = require('gulp-debug');
const _gulp               = require('gulp');

// Some gulp utility commands
const _gutil              = require('gulp-util');

// File system read access
const _fs                 = require('fs');

// Allows to output different builds depending on current environment. .env is located in the root of the repo
// ignored if .env not found
const _dotenv             = require('dotenv').config({ path: './../../../.env' });

// Compiling Sass
const _gulpsass           = require('gulp-sass');

// Postprocessing CSS
const _postcss            = require('gulp-postcss');

// CSS minification
const _cssnano            = require('cssnano'); 

// Joining CSS files
const _concat             = require('gulp-concat');

// Build notifications
const _notify             = require('gulp-notify'); 

// Uglifying JS
const _uglify             = require('gulp-uglify');

// Creates svg sprites from source svg files
const _svgsprite          = require('gulp-svg-sprite'); 

// Checks JS for mistakes. jshint-stylish should be installed too
const _jshint             = require('gulp-jshint'); 

// Autoprefixes Sass
const _autoprefixer       = require('autoprefixer');

// Generates Sass/JS sourcemaps for easier inbrowser debugging
const _sourcemaps         = require('gulp-sourcemaps');

// These handle merging JS modules 
const _browserify         = require('browserify');
const _source             = require('vinyl-source-stream');
const _buffer             = require('vinyl-buffer');

// Automatically reload browsers while watching
const _browsersync        = require('browser-sync').create();

// Allows to use ES2015 in JS. babel-preset-es2015 should be installed too
const _babelify           = require('babelify');

// Adds browser feature test results to HTML and JS
const _modernizr          = require('gulp-modernizr');

// Injects variables from config file to Sass
const _sassvariables      = require('gulp-sass-variables');

// Allows to import Sass npm modules with a shorter notation
const _packageimporter    = require('node-sass-package-importer');

// Allows to inline css @imports instead of just linking to them (node-sass has marked this option as deprecated). Place "!" before filename of a CSS file to have its contents injected
const _cssimporter        = require('node-sass-css-importer');

// Lints Sass and CSS
const _gulp_stylelint     = require('gulp-stylelint');

// Converts .po localisation files to .mo
const _gettext            = require('gulp-gettext');

const _phpcs              = require('gulp-phpcs');

// Source for variables shared between gulp, JS, and Sass
const _projectconfig      = require('./common_config.json');



// TASKS CONFIG


// Environment variables
// if defined as a gulp commandline argument (gulp --env=dev)
let is_env_dev = true;
if (typeof process.env.ENV !== 'undefined') {
  is_env_dev = (process.env.ENV === 'dev');
}
if (typeof _gutil.env.env !== 'undefined') {
  is_env_dev = (_gutil.env.env === 'dev');
}


// SVG sprite config
const svgsprite_config = {
  mode           : {
    symbol       : {
      dest       : '.',
      inline     : true,
      prefix     : '.u-svg-%s',
      dimensions : '-size',
      sprite     : config.dirs.assets + 'sprite.svg',
      render     : {
        css      : {
          dest   : config.dirs.generated + 'svg-sprite.css'
        }
      }
    }
  }
};


// Injecting config variables into Sass
let config_sass_vars = {};
for (var variable in _projectconfig) {
  config_sass_vars['$_' + variable] = _projectconfig[variable];
}
config_sass_vars['$_is-env-dev'] = is_env_dev;



// TASKS

// build_svg_sprite
function build_svg_sprite() {
  return _gulp.src(config.dirs.assets + 'svg-sprite-source/*.svg')
    .pipe(_svgsprite(svgsprite_config)).on('error', function(message) {
      console.log(message); 
    })
    .pipe(_gulp.dest('.'))
    .pipe(is_env_dev ? _notify('SVG sprite created successfully!') : _gutil.noop() );
}

// lint_css
function lint_css() {
  return _gulp
    .src(config.dirs.styles + '**/*.scss')
    .pipe(_gulp_stylelint({
      reporters: [
        {formatter: 'string', console: true}
      ]
    }));
}

// build_css, before: build_svg_sprite
function build_css() {
  let postcss_plugins = [
    _autoprefixer()
  ];
  if (!is_env_dev) {
    postcss_plugins.push(_cssnano());
  }
  return _gulp
    .src(config.dirs.styles + 'style.scss')
    .pipe( is_env_dev ? _sourcemaps.init() : _gutil.noop() )
    .pipe(_sassvariables(config_sass_vars))
    .pipe(_gulpsass({ 
      style: 'expanded',
      includePaths: [],
      importer: [_packageimporter(), _cssimporter()]
    }))
    .pipe(_concat('style.css'))
    .pipe(_postcss(postcss_plugins))
    .pipe( is_env_dev ? _sourcemaps.write() : _gutil.noop() )
    .pipe(_gulp.dest('./'))
    .pipe(_browsersync.stream())
    .pipe(is_env_dev ? _notify('CSS compiled and concatenated successfully!') : _gutil.noop() );
}

// lint_js
function lint_js() {
  const files_to_lint  = [
    __filename,
    config.dirs.scripts + 'modules/*.js'
  ];

  return _gulp.src(files_to_lint)
    .pipe(_jshint())
    .pipe(_jshint.reporter(require('jshint-stylish')));
}

// build_modernizr, before: build_css
function build_modernizr() {
  var paths = [
    config.dirs.scripts + 'main.js', 
    config.dirs.scripts + 'modules/*.js',
    'style.css'
  ];

  return _gulp
    .src(paths)
    .pipe(_modernizr('modernizr.js', {
      options: ['setClasses'],
      classPrefix: 'js-supports-'
    }))
    .pipe(_uglify())
    .pipe(_gulp.dest(config.dirs.scripts))
    .on('error', _gutil.log);
}

// bundlejs
function bundlejs() {

  return _browserify({
      entries: [config.dirs.scripts + 'main.js'],
      debug: is_env_dev ? true : false,
      transform: [
        _babelify.configure({
          presets: ['@babel/preset-env']
        })
      ]
    })
    .bundle()
    .on('error', _gutil.log)
    .pipe(_source('scripts.min.js'))
    .pipe(_buffer())
    // don't uglify if we're in local environment, do uglify if it's something other
    .pipe(is_env_dev ? _gutil.noop() : _uglify())
    .pipe(_gulp.dest(config.dirs.scripts));
}

// build_js, before: build_modernizr, bundlejs
function build_js(done) {
  let paths_to_check = [
    config.dirs.scripts + 'modernizr.js', 
    config.dirs.scripts + 'scripts.min.js'
  ];
  let paths = [];
  paths_to_check.forEach(path => {
    if (_fs.existsSync(path)) {
      paths.push(path);
    }
  });

  if (paths.length > 0) {
    return _gulp
      .src(paths)
      .pipe(_concat('scripts.min.js'))
      .pipe(_gulp.dest(config.dirs.scripts))
      .pipe(_browsersync.stream())
      .pipe(is_env_dev ? _notify('JS compiled and concatenated successfully!') : _gutil.noop());
  }
  done();
}


function build_po_to_mo() {
  return _gulp.src('languages/*.po')
    .pipe(_gettext())
    .pipe(_gulp.dest('languages'));
}


function lint_php() {
  return _gulp.src(['./**/*.php', '!vendor/**/*.*'])
  .pipe(_phpcs({
    bin: 'vendor/bin/phpcs',
    standard: './phpcs.xml',
  }))
  .pipe(_phpcs.reporter('log'));
}


// build_copy_jslibs
function build_copy_jslibs(done) {
  let paths_to_copy = [];
  config.js_libs_paths.forEach(path => {
    if (_fs.existsSync(path)) {
      paths_to_copy.push(path);
    } else {
      console.log(`JS lib at ${path} doesn't exist, can't copy`);
    }
  });
  if (paths_to_copy.length > 0) {
    console.log('Copying these JS libs: ', paths_to_copy);
    return _gulp
      .src(paths_to_copy)
      .pipe(_gulp.dest(config.dirs.scripts + 'libs/'));
  }
  done();
}


// reload, before: default
function reload(done) {
  _browsersync.reload();
  done();
}


// Main workflow/Local build
const tasks_build = _gulp.series(
  _gulp.parallel(
    build_po_to_mo,
    build_copy_jslibs, 
    _gulp.series(
      build_svg_sprite,
      build_css, // after build_svg_sprite: we need to have svg-sprite.css ready to include it into style.css
      build_modernizr // after build_css
    ),
    _gulp.series(
      bundlejs, 
      build_js
    ),
    lint_php
  )
);


// Serve (aka watch): serve, before: default
function serve(done) {
  let browsersyncSettings = {
    port: process.env.PORT ? process.env.PORT : 3001,
    open: false,
    notify: false
  };
  if (process.env.HOST) {
    browsersyncSettings = {
      ...browsersyncSettings,
      proxy: process.env.HOST
    };
  } else {
    browsersyncSettings = {
      ...browsersyncSettings,
      server: {
        baseDir: ['./']
      },
    };
  }
  _browsersync.init(browsersyncSettings);

  // Gulpfile.js:
  _gulp.watch(
    __filename, 
    _gulp.series(
      lint_js
    )
  );

  // Scripts:
  _gulp.watch(
    [
      config.dirs.scripts + 'main.js', 
      config.dirs.scripts + 'modules/*.js'
    ], 
    _gulp.parallel(
      lint_js,
      _gulp.series(
        bundlejs, 
        build_js,
        reload
      )
    )
  );
  
  // Templates:
  _gulp.watch(
    [
      './**/*.php',
      './templates/**/*.twig'
    ], 
    _gulp.series(
      reload
    )
  );
  
  // PHP linting:
  _gulp.watch(
    ['./**/*.php'],
    _gulp.series(
      lint_php
    )
  );

  // Styles:
  _gulp.watch(
    config.dirs.styles + '**/*.scss', 
    _gulp.parallel(
      lint_css,
      _gulp.series(
        build_svg_sprite,
        build_css
      )
    )
  );

  // SVG:
  _gulp.watch(
    config.dirs.assets + 'svg-sprite-source/*.svg', 
    _gulp.series(
      build_svg_sprite,
      reload
    )
  );

  // Po files:
  _gulp.watch(
    'languages/*.po', 
    _gulp.series(
      build_po_to_mo,
      reload
    )
  );

  done();
}


exports.watch = _gulp.parallel(tasks_build, serve);
exports.serve = _gulp.parallel(tasks_build, serve);
exports.build_css = _gulp.series(build_svg_sprite, build_css);
exports.default = tasks_build;
