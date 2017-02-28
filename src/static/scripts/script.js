$(function() {
    var validateForm = function() {
        var formIsValid = true;
        if ($("#restEndpoint").val().length === 0) {
            formIsValid = false;
        }
        $("#apiRequestExecute").prop("disabled", !formIsValid);
    };
    validateForm();
    $("#restEndpoint").on("change", validateForm);
    $("#restEndpoint").on("keyup", validateForm);

    $("input[type=radio][name=httpMethods]").on("change", function(event) {
        var httpMethod = $("input[name=httpMethods]:checked").val();
        if (httpMethod === "post") {
            $(".form-group.post").removeClass("hidden");
        } else {
            $(".form-group.post").addClass("hidden");
        }
    });
    $("#apiRequestExecute").on("click", function(event) {
        var httpMethod = $("input[name=httpMethods]:checked").val();
        var request = null;
        var ajaxOptions = {};

        ajaxOptions.url = $("#restEndpoint").val();
        ajaxOptions.method = httpMethod.toUpperCase();

        var headers = $("#headers").val() || {
            "accept": "application/json; odata=verbose",
            "content-type": "application/json; odata=verbose"
        };
        if (headers.length > 0) {
            try {
                headers = JSON.parse(headers);
                ajaxOptions.headers = headers;
            } catch (ex) {
                $(".resultsArea .loading").addClass("hidden");
                $(".resultsArea .requestResutls").addClass("hidden").text("");
                $(".resultsArea .requestError").addClass("hidden").text("");
                $(".resultsArea .requestError").append("Headers body is not a correct JSON string!").removeClass("hidden");
                return;
            }
        }

        if (httpMethod === "post") {
            var postBody = $("#postBody").val();
            if (postBody.length > 0) {
                try {
                    JSON.parse(postBody);
                } catch (ex) {
                    $(".resultsArea .loading").addClass("hidden");
                    $(".resultsArea .requestResutls").addClass("hidden").text("");
                    $(".resultsArea .requestError").addClass("hidden").text("");
                    $(".resultsArea .requestError").append("Data body is not a correct JSON string!").removeClass("hidden");
                    return;
                }
            }
            ajaxOptions.data = JSON.parse(postBody);
            // ajaxOptions.body = JSON.parse(postBody);
        }

        $(".resultsArea .loading").removeClass("hidden");
        $(".resultsArea .requestResutls").addClass("hidden").text("");
        $(".resultsArea .requestError").addClass("hidden").text("");

        request = $.ajax(ajaxOptions);
        request.done(function(msg) {
            $(".resultsArea .loading").addClass("hidden");
            $(".resultsArea .requestResutls").text(JSON.stringify(msg, null, '  ')).removeClass("hidden");
        });
        request.fail(function(jqXHR, textStatus) {
            $(".resultsArea .loading").addClass("hidden");
            $(".resultsArea .requestError").text(JSON.stringify(jqXHR, null, '  ')).removeClass("hidden");
        });
    });

    $.ajax({
        url: "/config",
        method: "GET",
        success: function(data) {
            $("#siteUrl").text(data.siteUrl);
            $("#username").text(data.username);
        },
        error: function(error) {
            console.log("Error: ", error);
        }
    });
});