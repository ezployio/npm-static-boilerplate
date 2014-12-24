var
  Hogan = require('hogan'),
  fs = require('fs'),
  async = require('async'),
  path = require('path');

var
  assets = require('./assets'),
  template_dir = path.resolve(__dirname, 'assets/markup'),
  output_dir = path.resolve(__dirname, 'dist'),
  layout = 'layout.html',
  files = [],
  tree = {},
  dist_dir = 'dist';

Hogan.fcompile = function(file_path, options) {
  options = options || {};
  options.filename = file_path;

  var
    key = file_path + ':string',
    rt,
    text;

  if (options.cache && Hogan.fcache[key]) {
    return Hogan.fcache[key];
  }

  text = fs.readFileSync(file_path, 'utf8');

  try {
    rt = Hogan.generate(Hogan.parse(Hogan.scan(text, options.delimiters), text, options), text, options);
  } catch (error) {
    throw new Error('Error reading template file ' + file_path + ': ' + error.message);
  }

  return options.cache ? Hogan.fcache[key] = rt : rt;
};

var renderPartials = function renderPartials(partials, opt) {
  var
    name,
    partial_path,
    result = {};

  for (name in partials) {
    partial_path = partials[name];
    if (typeof partial_path !== 'string') {
      continue;
    }
    partial_path = path.join(template_dir, partial_path + '.html');
    result[name] = Hogan.fcompile(partial_path, opt);
    tree[path.basename(partial_path)].rendered = true;
  }
  return result;
};


var renderFile = function renderFile(file_path, options, callback) {
  var
    p = {},
    rendered,
    partials,
    compiled_layout,
    compiled;

  try {
    compiled_layout = Hogan.fcompile(path.join(template_dir, layout));
    compiled = Hogan.fcompile(file_path);
  } catch (error) {
    callback(error);
  }

  for (var prop in compiled.partials) {
    p[compiled.partials[prop].name] = compiled.partials[prop].name;
  }

  partials = renderPartials(p);
  partials.yield = compiled;

  rendered = compiled_layout.render(assets, partials);
  return rendered;
};

var renderFiles = function renderFiles(files, callback) {
  var
    rendered,
    file_path;

  async.each(files, function(file, fn) {
    file_path = path.join(template_dir, file);

    if (tree[file].rendered === false) {
      rendered = renderFile(file_path);
      tree[file].rendered = true;

      fs.writeFile(path.join(output_dir, file), rendered, {
        encoding: 'UTF-8'
      }, function(error) {
        if (error) {
          throw error;
        }
        fn();
      });
    }
  }, function() {
    return callback();
  });
}

for (var k in assets) {
  assets[k] = assets[k].substring(5);
}

fs.readdir(template_dir, function(error, templates) {
  if (error) {
    throw error;
  }
  async.each(templates, function(template, fn) {
    if (path.extname(template) === '.html' && template !== layout) {
      tree[template] = {
        rendered: false
      };

      files.push(template);
    }
    fn();
  }, function() {
    renderFiles(files, function() {});
  });
});
