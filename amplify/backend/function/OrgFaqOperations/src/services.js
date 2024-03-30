const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
// AWS.config.update({ region: 'us-east-1' });

const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const {fetchOrgDetailsSpecificAttributes} = require('@dbutils/orgEntity');
const { fetchUserSummaryInsights,fetchNegativeUserFeeback } = require('@searchutils/faq');
const { FaqDateRanges,FaqMetrics } = require('@commonutils/constants');

/**
 * Fetch user feeback summary
 * @param {*} orgId
 * @param {*} dateRange
 * @returns 
 */
 const getUserFeedbackSummary = async function (orgId,dateRange) {
    try {
        let response;
        let totalCount = 0,posCount=0,negCount=0,ignoreCount=0;
        if(orgId && dateRange){
            // console.log("Inside services - getUserFeedbackSummary - incoming: ",orgId,dateRange);

            //TODO - compute date range in format to send to ES query
            let dates = getDatesFromRange(dateRange);
            console.log("Inside getUserFeedbackSummary - dates",dates.startDate,dates.endDate);

            //ES query
            let data = await fetchUserSummaryInsights(orgId,dates.startDate,dates.endDate);
            
            //format the data back into how we want it
            if(data && data.length > 0){
                // console.log("Inside services - getUserFeedbackSummary - data back: ",data);
                for(const element of data){
                    if(element && element.key){
                        if(element.key.userVote === "No" && element.doc_count){
                            negCount = element.doc_count;
                            totalCount += negCount;
                            continue;
                        }
                        if(element.key.userVote === "Yes" && element.doc_count){
                            posCount = element.doc_count;
                            totalCount += posCount;
                            continue;
                        }
                        if(element.key.userVote === null && element.doc_count){
                            ignoreCount = element.doc_count;
                            totalCount += ignoreCount;
                            continue;
                        }
                    }
                }
            }

            if(totalCount != 0){
                if(negCount != 0){
                    negCount = negCount + " (" + (Math.round((negCount/totalCount) * 1000) / 10).toString() + "%)";
                }else{
                    negCount = '' + negCount;
                }

                if(posCount != 0){
                    posCount = posCount + " (" + (Math.round((posCount/totalCount) * 1000) / 10).toString() + "%)";
                }else{
                    posCount = '' + posCount;
                }

                if(ignoreCount != 0){
                    ignoreCount = ignoreCount + " (" + (Math.round((ignoreCount/totalCount) * 1000) / 10).toString() + "%)";
                }else{
                    ignoreCount = '' + ignoreCount;
                }

            }else{
                negCount = '' + negCount;
                posCount = '' + posCount;
                ignoreCount = '' + ignoreCount;
            }
            totalCount = '' + totalCount;            
        }

        response = {
            total : totalCount,
            positive : posCount,
            negative : negCount,
            ignored : ignoreCount
        };
        console.log("response",response);

        if(response){
            return ResponseFormatter(response);
        }else{
            return ResponseFormatter([]);
        }

    }catch(error){
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }
 };

 /**
 * Fetch negative user feedback aggregate
 * @param {*} orgId
 * @param {*} dateRange
 * @returns 
 */
  const getNegativeUserResponses = async function (orgId,dateRange) {
    try {
        let response;
        let dataArr = [];
        if(orgId && dateRange){
            // console.log("Inside services - getNegativeUserResponses - incoming: ",orgId,dateRange);

            //TODO - compute date range in format to send to ES query
            let dates = getDatesFromRange(dateRange);
            console.log("Inside getNegativeUserResponses - dates",dates.startDate,dates.endDate);

            //ES query
            let data = await fetchNegativeUserFeeback(orgId,dates.startDate,dates.endDate);

            //format the data back into how we want it
            if(data && data.length>0){
                // console.log("Inside services - getNegativeUserResponses - data back: ",data);
                for(const element of data){
                    if(element){
                        let tempJSON = {};
                        if(element.key && element.key.faqAnswer){
                            tempJSON.queryText = element.key.faqAnswer;
                        }
                        if(element.doc_count){
                            tempJSON.firstColumnData = element.doc_count;
                        }
                        dataArr.push(tempJSON);
                    }
                }
            }        
        }

        response = {
            headers : ["Response Text","Count"],
            data : dataArr
        };
        console.log("response",response);

        if(response){
            return ResponseFormatter(response);
        }else{
            return ResponseFormatter([]);
        }

    }catch(error){
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }
 };


const getDatesFromRange = function (dateRange) {

    let startDate,endDate;
    try{
        let startDate = new Date();
        let endDate = new Date();
        let sunday = new Date();
        sunday = sunday.setDate(sunday.getDate() - (sunday.getDay() + 7) % 7); //get last sunday
        let sundayDate = new Date(sunday);

        if(dateRange === FaqDateRanges.THIS_WEEK){

            if(startDate.getDay() == 0){
                //when today is Sunday
                startDate = startDate.setDate(startDate.getDate() - 7);
                startDate = convertDateToString(startDate);
                endDate = endDate.setDate(endDate.getDate()-1);
                endDate = convertDateToString(endDate);  
            }
            else{
                startDate = sundayDate;
                startDate = convertDateToString(startDate);
                endDate = endDate.setDate(endDate.getDate()-1);
                endDate = convertDateToString(endDate);
            }

        }else if(dateRange === FaqDateRanges.ONE_WEEK_AGO){
            startDate = new Date(sundayDate);
            endDate = new Date(sundayDate);
            startDate = startDate.setDate(startDate.getDate() - 7);
            endDate = endDate.setDate(endDate.getDate() - 1);
            startDate = convertDateToString(startDate);
            endDate = convertDateToString(endDate);

        }else if(dateRange === FaqDateRanges.TWO_WEEKS_AGO){
            startDate = new Date(sundayDate);
            endDate = new Date(sundayDate);
            startDate = startDate.setDate(startDate.getDate() - 14);
            endDate = endDate.setDate(endDate.getDate() - 8);
            startDate = convertDateToString(startDate);
            endDate = convertDateToString(endDate);
            
        }else if(dateRange === FaqDateRanges.THIS_MONTH){
            startDate = startDate.setDate(1);
            startDate = convertDateToString(startDate);
            endDate = convertDateToString(endDate);
            
        }else if(dateRange === FaqDateRanges.ONE_MONTH_AGO){
            startDate = startDate.setMonth(startDate.getMonth() - 1);
            startDate = new Date(startDate);
            startDate = startDate.setDate(1);
            endDate = endDate.setDate(1);
            startDate = convertDateToString(startDate);
            endDate = convertDateToString(endDate);
            
        }else if(dateRange === FaqDateRanges.TWO_MONTHS_AGO){
            startDate = startDate.setMonth(startDate.getMonth() - 2);
            startDate = new Date(startDate);
            startDate = startDate.setDate(1);
            endDate = endDate.setMonth(endDate.getMonth() - 1);
            endDate = new Date(endDate);
            endDate = endDate.setDate(1);
            startDate = convertDateToString(startDate);
            endDate = convertDateToString(endDate);
            
        }
        return {startDate,endDate};

    } catch(error){
        console.error(error);
        return {startDate,endDate};
    }
}

const convertDateToString = function (dateObj){
    try {
        let formattedDate;
        if(dateObj){
            formattedDate = new Date(dateObj);
        }
        else{
            formattedDate = new Date(); 
        }
        let monStr= formattedDate.getMonth() > 9 ? (formattedDate.getMonth()+1)+"" : "0"+(formattedDate.getMonth()+1);
        let dayStr = formattedDate.getDate() > 9 ? formattedDate.getDate()+"" : "0"+formattedDate.getDate();
        let dtStr = formattedDate.getFullYear()+"-"+monStr+"-"+dayStr;
        return dtStr;

    } catch(error){
        console.error(error);
        return undefined;
    }
}

const prepareResponseJSON = function (metric){
    let finalResponse = {};

    if(metric === FaqMetrics.AGG_QUERY_DOC_METRICS){
        finalResponse.headers = undefined;
        finalResponse.data = {};
        finalResponse.data.totalQueries = "0";
        finalResponse.data.instAnsRate = "0%";
        finalResponse.data.zeroSearchResultsRate =  "0%";
        finalResponse.data.ctr = "0%";

    }else if(metric === FaqMetrics.QUERIES_BY_COUNT){
        finalResponse.headers = ["Query","Count","Instant Answer Rate (%)"];
        finalResponse.data = [];

    }else if(metric === FaqMetrics.QUERIES_BY_ZERO_RESULT_RATE){
        finalResponse.headers = ["Query","Count","Proportion to all queries (%)"];
        finalResponse.data = [];
    }

    return finalResponse;

};

module.exports = {
    getUserFeedbackSummary,
    getNegativeUserResponses
};