module.exports = function (gulp, $) {
    'use strict';

    gulp.task('tsc', function () {
        let tsSourcesResult = gulp.src(['src/**/*.ts'])
            .pipe($.sourcemaps.init())
            .pipe($.tsc.createProject('tsconfig.json')());

        let sources = tsSourcesResult.js
            .pipe($.sourcemaps.write('.'))
            .pipe(gulp.dest('./dist'));

        let declarations = tsSourcesResult.dts
            .pipe(gulp.dest('./dist'));

        return $.merge(sources, declarations);
    });
};
