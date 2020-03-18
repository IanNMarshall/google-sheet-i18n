'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sheetsHelper = require('./sheets-helper');

var _formatter = require('./formatter');

var _configHelper = require('./config-helper');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _process = process,
    stdout = _process.stdout;

var fs = _bluebird2.default.promisifyAll(_fsExtra2.default);


var config = (0, _configHelper.getConfig)();

var outputs = config.outputs,
    categories = config.categories,
    languages = config.languages;


var delimiter = config.delimiter || '.';

/**
 * Gets all the rows from the sheet, filters out undefined rows
 */
var getSheetRows = function getSheetRows(worksheet) {
  return new _bluebird2.default(function (resolve, reject) {
    return (0, _sheetsHelper.getRows)(worksheet).then(function (rows) {
      var newRows = rows.map(function (row) {
        return (0, _formatter.formatRow)(row, categories, languages, delimiter);
      }).filter(function (row) {
        return row !== null;
      });
      resolve({
        title: worksheet.title.toLowerCase(),
        rows: newRows
      });
    }).catch(reject);
  });
};

/**
 * Prepares data to be used with the mapper
 */
var prepareMapData = function prepareMapData(rows, language) {
  return rows.map(function (row) {
    var key = Object.keys(row)[0];
    return {
      key: key,
      data: row[key][language]
    };
  });
};

/**
 * Attempts to load a mapper, if a mapper is set by the user, use it,
 * other wise try to load a preset
 */
var prepareMapper = function prepareMapper(preset, mapper) {
  var userPreset = null;
  if (mapper) {
    userPreset = mapper;
  } else {
    userPreset = require(_path2.default.join(__dirname, '../', 'lib/presets', preset));
  }
  return userPreset;
};

var createConcatenatedTranslations = function createConcatenatedTranslations(rows, outPath, preset, mapper, prefix, suffix) {
  _bluebird2.default.all(languages.map(function (language) {
    return fs.ensureDirAsync('' + outPath).then(function () {
      var _prepareMapper = prepareMapper(preset, mapper),
          fileMapper = _prepareMapper.fileMapper,
          fileExtension = _prepareMapper.fileExtension;

      var mappedRows = prepareMapData(rows, language);
      var output = fileMapper(mappedRows, language);
      var writePath = outPath + '/' + ((prefix || '') + language + (suffix || '') + fileExtension);
      return fs.writeFileAsync(writePath, output, 'utf8');
    });
  }));
};

var getTranslations = function getTranslations(title, rows, outPath, preset, mapper, prefix, suffix) {
  return languages.map(function (language) {
    return fs.ensureDirAsync(outPath + '/' + language).then(function () {
      var _prepareMapper2 = prepareMapper(preset, mapper),
          fileMapper = _prepareMapper2.fileMapper,
          fileExtension = _prepareMapper2.fileExtension;

      var mappedRows = prepareMapData(rows, language);
      var output = fileMapper(mappedRows, language);
      var writePath = outPath + '/' + language + '/' + ((prefix || '') + title + (suffix || '') + fileExtension);

      return fs.writeFileAsync(writePath, output, 'utf8');
    });
  });
};

var createTranslations = function createTranslations(sheets, outPath, preset, mapper, prefix, suffix) {
  return _bluebird2.default.all(sheets.map(function (_ref) {
    var title = _ref.title,
        rows = _ref.rows;
    return getTranslations(title, rows, outPath, preset, mapper, prefix, suffix);
  }));
};

var generateTranslations = function generateTranslations(sheets, _ref2) {
  var concat = _ref2.concat,
      mapper = _ref2.mapper,
      name = _ref2.name,
      outPath = _ref2.outPath,
      prefix = _ref2.prefix,
      preset = _ref2.preset,
      suffix = _ref2.suffix;


  stdout.write('Generating i18n files for the ' + name + ' output ');
  var translationPromise = null;
  if (concat) {
    var rows = sheets.reduce(function (prev, curr) {
      return prev.concat(curr.rows);
    }, []);
    translationPromise = createConcatenatedTranslations(rows, outPath, preset, mapper, prefix, suffix);
  } else {
    translationPromise = createTranslations(sheets, outPath, preset, mapper, prefix, suffix);
  }

  return translationPromise;
};

var getSheets = function getSheets(_ref3) {
  var worksheets = _ref3.worksheets;

  stdout.write('Fetching Rows from Google Sheets!!! ');
  return new _bluebird2.default(function (resolve, reject) {
    return _bluebird2.default.all(worksheets.map(getSheetRows)).then(function (sheets) {
      stdout.write('\u2713 \n');
      return resolve(sheets);
    }).catch(reject);
  });
};

var beginTranslations = function beginTranslations(sheets) {
  return _bluebird2.default.all(outputs.map(function (output) {
    return new _bluebird2.default(function (resolve, reject) {
      return fs.removeAsync(output.outPath).then(function () {
        return fs.ensureDirAsync(output.outPath);
      }).then(function () {
        return generateTranslations(sheets, output);
      }).then(function () {
        stdout.write('\u2713 \n');
        resolve(true);
      }).catch(reject);
    });
  }));
};

var start = function start() {
  if (config) {
    var doc = (0, _configHelper.getDocument)(config);
    (0, _configHelper.authorizeConnection)(config, doc).then(function () {
      return (0, _sheetsHelper.getInfo)(doc);
    }).then(getSheets).then(beginTranslations).then(function () {
      return stdout.write('Successfully generated i18n files! \n');
    });
  } else {
    stdout.write('You don\'t have a configuration file!');
  }
};

exports.default = start;