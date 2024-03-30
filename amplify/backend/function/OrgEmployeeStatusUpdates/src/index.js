const AWS = require('aws-sdk');
const region = process.env.TABLE_REGION;
var glue = new AWS.Glue();

AWS.config.update({ region: region});

exports.handler = function(event, context, callback) {
  console.log(event);
  let tabledetails = JSON.parse(JSON.stringify(event.Records[0].dynamodb));
  console.log(tabledetails);

  if(event.Records[0].eventName == 'MODIFY'){
    let newStatus = tabledetails.NewImage.status.S;
    let oldStatus = tabledetails.OldImage.status.S;

    if(newStatus != oldStatus){
      let candidateId = tabledetails.NewImage.candidateId.N;
      let requisitionId = tabledetails.NewImage.requisitionId.N;
      var params = {
        JobName: 'EmployeeStatusUpdate', 
        Arguments: {
          '--candidateId': candidateId,
          '--requisitionId': requisitionId,
          '--newStatus': newStatus
        }
      };
    
      glue.startJobRun(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     console.log(data);           // successful response
      });
    }
    else{
      console.log('Field updated in OrgUser table is not status');
    }
  }
  console.log('event is :'+ event.Records[0].eventName);
}