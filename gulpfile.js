'use strict';

const gulp = require('gulp');
const merge = require('merge-stream');
const tslint = require('gulp-tslint');
const tsc = require('gulp-typescript');

const tsconfig = require('./tsconfig.json');

gulp.task('clean', () => {
    const del = require('del');
    return del(['dist/**']);
});

gulp.task('prepublish', ['clean'], () => {
    let tsSourcesResult = gulp
        .src(['./src/**/*.ts'])
        .pipe(tsc.createProject('tsconfig.json')());

    return merge[
        tsSourcesResult.js.pipe(gulp.dest('./dist')),
        tsSourcesResult.dts.pipe(gulp.dest('./dist'))
    ];
});

gulp.task('tsc', () => {
    const sourcemaps = require('gulp-sourcemaps');

    let tsSourcesResult = gulp.src(['src/**/*.ts'])
        .pipe(sourcemaps.init())
        .pipe(tsc.createProject('tsconfig.json')());

    let sources = tsSourcesResult.js
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./dist'));

    let declarations = tsSourcesResult.dts
        .pipe(gulp.dest('./dist'));

    return merge(sources, declarations);
});

gulp.task('tslint', () => {
    const yargs = require('yargs');
    let emitError = yargs.argv.emitError;
    return gulp.src(['src/**/*.ts'])
        .pipe(tslint({
            configuration: './tslint.json',
            formatter: 'verbose'
        }))
        .pipe(tslint.report({
            summarizeFailureOutput: true,
            emitError: emitError
        }));
});