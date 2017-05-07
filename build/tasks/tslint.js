module.exports = function (gulp, $) {
    'use strict';

    let emitError = !!$.yargs.argv.emitError;

    gulp.task('tslint', function () {
        return gulp.src(['src/**/*.ts'])
            .pipe($.tslint({
                configuration: './tslint.json',
                formatter: 'verbose'
            }))
            .pipe($.tslint.report({
                summarizeFailureOutput: true,
                emitError: emitError
            }));
    });
};
