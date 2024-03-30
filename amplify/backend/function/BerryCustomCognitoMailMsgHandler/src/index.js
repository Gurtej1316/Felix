const { SecretKeys, RetrieveSecretAttribute } = require('@commonutils/secretManager');
const { AppURLs } = require('@commonutils/constants');

exports.handler = async (event, context, callback) => {
    console.log(event);
    var userPoolId = await RetrieveSecretAttribute(SecretKeys.COGNITO_USER_POOL_ID, SecretKeys.COGNITO_USER_POOL_ID + "-" + process.env.ENV);
    let appURL;
    if (AppURLs[process.env.ENV.toUpperCase()]) {
        appURL = AppURLs[process.env.ENV.toUpperCase()]+'resetpassword';
    }
    else {
        appURL = AppURLs['LOCAL']+'resetpassword';
    }
    if (event.userPoolId === userPoolId) {
        if (event.triggerSource === "CustomMessage_ForgotPassword") {
            const resetPasswordMessage = `
                <head>
                    <style>
                    a {color : #e14dca !important; text-decoration: none;}
                    </style>
                </head>
                <body>
                    <table border="0" cellpadding="0" cellspacing="0"
                        style="width:100%;margin:0;padding:0;font-size:14px;line-height:1.43;letter-spacing:-.2px;text-align:left;color:#575757;font-family:Rubik,sans-serif">
                        <tbody>
                            <tr>
                                <td align="center">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="border-collapse:collapse;width:600px;background:#222130;border:1px solid #575757">
                                        <tbody>
                                            <tr>
                                                <td style="background:#302f41;padding:22px 0 22px 45px">
                                                    <table align="left" cellpadding="0" cellspacing="0" width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td align="left" style="padding:0px">
                                                                    <a href="https://berryworks.ai/" target="_blank" style="display:flex;align-items: center;text-decoration: none;"><img
                                                                        src="http://berryworks.ai/wp-content/uploads/2022/08/berryIcon.png"
                                                                        style="display:block;margin: 7px;" width="50" alt="Berry_Logo.png"
                                                                        data-bit="iit"><h2 style="display: inline;color: #fff;padding-left: 5px;">BerryWorks</h2></a>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:20px 46px 20px 46px">
                                                    <table align="center" cellpadding="0" cellspacing="0" width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:8px 0 0;font-family:Rubik,sans-serif;font-weight:500">
                                                                    <p
                                                                        style="color:#ffffff;margin:0;font-size:30px;line-height:44px;letter-spacing:.010em">
                                                                        <strong>Password Reset</strong>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="left"
                                                                    style="padding:8px 0 0;font-family:Rubik,sans-serif;font-weight:500">
                                                                    <p
                                                                        style="color:#ffffff;margin:0;font-size:15px;line-height:44px;letter-spacing:.010em">
                                                                        <strong>Please provide the following code in the <a style = "color:#e14dca; font-weight:500px" href=${appURL}>reset password</a> form.</strong>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr align="center">
                                                                <td align="center" style="margin: 22px 0px;padding: 10px 14px;text-decoration:none;text-decoration: none;font-size:30px;color:#fff;letter-spacing:.015em;border-radius:8px;display:inline-block">
                                                                ${event.request.codeParameter}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="left" style="padding:30px 45px;background:#302f41">
                                                    <table align="left" cellpadding="0" cellspacing="0" width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td
                                                                    style="font-size:14px;line-height:28px;letter-spacing:.015em;color:#ffffff;padding-bottom:10px">
                                                                    to talk to us, drop an email to <a href="mailto:sales@berryworks.ai"
                                                                        style="text-decoration:underline;color:#ffffff"
                                                                        target="_blank">sales@berryworks.ai</a>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td
                                                                    style="font-size:15px;line-height:29px;letter-spacing:.016em;color:#ffffff">
                                                                    © 2022 Berryworks Inc</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </body>`
            // Ensure that your message contains event.request.codeParameter event.request.usernameParameter. This is the placeholder for the code and username that will be sent to your user.
            event.response.emailSubject = "Berry - Password reset code";
            event.response.emailMessage = resetPasswordMessage;
        }        // Create custom message for other events
    }
    // Return to Amazon Cognito
    callback(null, event);
};