'use strict';

process.env.NODE_ENV = 'development';

let gulp = require('gulp');
let plugins = require('gulp-load-plugins')({
    pattern: ['gulp-*', 'gulp.*', 'run-sequence', 'merge-stream', 'yargs', 'del'],
    rename: {
        'gulp-typescript': 'tsc',
        'run-sequence': 'rns',
        'merge-stream': 'merge'
    }
});
let taskPath = './build/tasks/';
let taskList = require('fs').readdirSync(taskPath);

taskList.forEach(function (taskFile) {
    require(taskPath + taskFile)(gulp, plugins);
});