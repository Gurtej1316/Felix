/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
Amplify Params - DO NOT EDIT */
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
var glue = new AWS.Glue();
const uniqid = require('uniqid');

AWS.config.update({ region: process.env.TABLE_REGION });

exports.handler = async (event, context, callback) => {
  
  const bucket = event.Records[0].s3.bucket.name; 
  const key = event.Records[0].s3.object.key; 
  const gluejobname = "BerryOrgDataUpload";
  var filename = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  var path = 's3://'+bucket+'/'+filename;
  try {
  
    const bucketParams = {
      Bucket: bucket, 
      Key: key
    };

    console.log("bucket params for getObject-",bucketParams);

    var s3Response = await s3.getObject(bucketParams).promise();
    console.log("s3 response -", s3Response);
    var jobParams = {
      JobName: gluejobname, 
      Arguments: {
        '--JOB_NAME' : gluejobname,
        '--input_path' : path,
        '--envName' : process.env.ENV,
        '--dynamodb_write_throughput_percent' : '0.5',
        '--workflowId1' : uniqid('cmpgn-'),
        '--workflowId2' : uniqid('cmpgn-'),
        '--parentWorkflowId1': uniqid('cmpgn-'),
        '--parentWorkflowId2': uniqid('cmpgn-'),
        '--stepId1':  uniqid('stp-'),
        '--stepId2':  uniqid('stp-')
      }
    };

    var glueResponse = await glue.startJobRun(jobParams).promise();
    console.log("glue response-", glueResponse);
  } catch (error) {
    console.log(error);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
  } 
};