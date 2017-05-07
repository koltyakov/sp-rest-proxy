module.exports = function (gulp, $) {
    'use strict';

    let tsconfig = require('./../../tsconfig.json');

    gulp.task('clean', function () {
        return $.del(['dist/**']);
    });

    gulp.task('prepublish', ['clean'], function () {
        let tsSourcesResult = gulp.src(['./src/**/*.ts'])
            .pipe($.tsc.createProject('tsconfig.json')());

        return $.merge[
            tsSourcesResult.js
                .pipe(gulp.dest('./dist')),
            tsSourcesResult.dts
                .pipe(gulp.dest('./dist'))
        ];
    });
};
