const { getSearchQuery } = require("@commonutils/search");
const { getAggregationQuery, getAggregateResponse } = require("@commonutils/aggregate");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices } = require('@searchutils/models');
const { SentimentRange } = require('@commonutils/constants');

const minThreshold = 2.5;
const maxThreshold = 10;
const maxPatternThreshold = 7.5;
const minPatternThreshold = 5;

/**
 * Service function which holds business logic to perform aggregated queries on Conversation index.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getAggregatedResults = async (orgId, filterOptions, periodFilter, aggregateOptions) => {
  let searchQuery;
  if(filterOptions){
    if(filterOptions?.filters?.length>0 || filterOptions?.mustNotFilters){
    searchQuery = getSearchQuery(Entities.conversations, filterOptions);
    }
  }
 
  const aggregationQuery = getAggregationQuery(Entities.conversations, aggregateOptions);
  const elasticQuery = {
    aggs: aggregationQuery
  };

  if(searchQuery){
    elasticQuery['query'] = searchQuery.query
  }
  console.info(JSON.stringify(elasticQuery));
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.conversations,
    body: elasticQuery
  });
  return getAggregateResponse(aggregateOptions, elasticResponse);
};

const constructExecutiveSummary = async (avgScores, avgOverall) => {
  let sentimentByYear = [];
  for (const [key, value] of Object.entries(avgScores)) {
    if (value && value.sentimentScore && value.sentimentScore.value) {
      sentimentByYear.push(value.sentimentScore.value);
    }
  }
  sentimentByYear = sentimentByYear.slice(-3);

  let yearOneGreater = 0;
  let yearTwoGreater = 0;
  let yearOnePercentIncrease = 0;
  let yearTwoPercentIncrease = 0;

  let execSummary = "Overall sentiment is ";

  if (avgOverall < SentimentRange.neutralMin) { execSummary = execSummary + "negative"; }
  else if (avgOverall >= SentimentRange.neutralMin && avgOverall < SentimentRange.neutralMax) { execSummary = execSummary + "neutral"; }
  else { execSummary = execSummary + "positive"; }

  if (sentimentByYear.length > 1) {
    if (sentimentByYear[0] > sentimentByYear[1]) {
      yearOnePercentIncrease = ((sentimentByYear[0] - sentimentByYear[1]) / sentimentByYear[0]) * 100;
      yearOneGreater = 0;

    }
    else if (sentimentByYear[0] < sentimentByYear[1]) {
      yearOnePercentIncrease = ((sentimentByYear[1] - sentimentByYear[0]) / sentimentByYear[1]) * 100;
      yearOneGreater = 1;
    }
    if (sentimentByYear[2]) {
      if (sentimentByYear[1] > sentimentByYear[2]) {
        yearTwoPercentIncrease = ((sentimentByYear[1] - sentimentByYear[2]) / sentimentByYear[1]) * 100;
        yearTwoGreater = 1;
      }
      else if (sentimentByYear[1] < sentimentByYear[2]) {
        yearTwoPercentIncrease = ((sentimentByYear[2] - sentimentByYear[1]) / sentimentByYear[2]) * 100;
        yearTwoGreater = 2;

      }
    }

    if (yearOnePercentIncrease > minThreshold) {
      if (yearOneGreater == 0 && yearTwoGreater == 1 && yearTwoPercentIncrease > minThreshold) {
        execSummary = execSummary + " and has consistently declined over the past couple of years"
      }

      if (yearOneGreater == 1 && yearTwoGreater == 2 && yearTwoPercentIncrease > minThreshold) {
        execSummary = execSummary + " and has consistently improved over the past couple of years"
      }

      if (yearOneGreater == 0 && yearTwoGreater == 2 && yearTwoPercentIncrease > minThreshold) {
        execSummary = execSummary + " and has after a dip couple of years ago, improved since then"
      }

      if (yearOneGreater == 1 && yearTwoGreater == 1 && yearTwoPercentIncrease > minThreshold) {
        execSummary = execSummary + " and has after a improvement couple of years ago, declined since then"
      }
    }

    if (yearOnePercentIncrease <= minThreshold && yearTwoPercentIncrease <= minThreshold) {
      execSummary = execSummary + " and has remained consistent over the past couple of years"
    }

    if (yearTwoPercentIncrease > maxThreshold && yearTwoGreater == 1) {
      execSummary = execSummary + ", and there has been a significant dip in sentiment this year.";
    }

    if (yearTwoPercentIncrease > maxThreshold && yearTwoGreater == 2) {
      execSummary = execSummary + ", and there has been a significant increase in positive sentiment this year”";
    }
  }
  return execSummary;
}


const constructExecutiveSentimentSummary = async (sentimentAggs) => {
  let posExecSummary = "";
  let negExecSummary = "";
  const positivePatterns = sentimentAggs?.find(item => item.label === "POSITIVE") ?? undefined;
  const negativePatterns = sentimentAggs?.find(item => item.label === "NEGATIVE") ?? undefined;
  const positiveRespCount = positivePatterns?.count ?? 0;
  const negativeRespCount = negativePatterns?.count ?? 0;
  const posPatternArray = positivePatterns?.aggs?.mostProbablePattern ?? [];
  const negPatternArray = negativePatterns?.aggs?.mostProbablePattern ?? [];

  let posPatterns = posPatternArray.length > 0 ? await fetchPatternsForSummary(positiveRespCount, posPatternArray, maxPatternThreshold) : [];
  let negPatterns = negPatternArray.length > 0 ? await fetchPatternsForSummary(negativeRespCount, negPatternArray, maxPatternThreshold) : [];

  if (posPatterns.length > 0) {
    posExecSummary = ". Positive sentiment driven largely due to ";
    if (posPatterns.length > 2) {
      posExecSummary = posExecSummary + posPatterns[0] + ", " + posPatterns[1] + " and " + posPatterns[2];
    }
    else if (posPatterns.length == 2) {
      posExecSummary = posExecSummary + posPatterns[0] + " and " + posPatterns[1];
    }
    else {
      let minPosPatterns = posPatternArray.length > 0 ? await fetchPatternsForSummary(positiveRespCount, posPatternArray, minPatternThreshold) : [];
      if (minPosPatterns.length > 0) {
        posExecSummary = posExecSummary + minPosPatterns[0];
        posExecSummary = minPosPatterns[1] ? (posExecSummary + " and " + minPosPatterns[1]) : posExecSummary;
      }
    }

  }

  if (negPatterns.length > 0) {
    negExecSummary = ". But there is a perception of ";
    if (negPatterns.length > 2) {
      negExecSummary = negExecSummary + negPatterns[0] + ", " + negPatterns[1] + " and " + negPatterns[2] + ", which is negatively impacting sentiment.";
    }
    else if (negPatterns.length == 2) {
      negExecSummary = negExecSummary + negPatterns[0] + " and " + negPatterns[1] + ", which is negatively impacting sentiment.";
    }
    else {
      let minNegPatterns = posPatternArray.length > 0 ? await fetchPatternsForSummary(negativeRespCount, negPatternArray, minPatternThreshold) : [];
      if (minNegPatterns.length > 0) {
        negExecSummary = negExecSummary + minNegPatterns[0];
        negExecSummary = minNegPatterns[1] ? (negExecSummary + " and " + minNegPatterns[1]) : negExecSummary;
      }
      else {
        negExecSummary = negExecSummary + "largely driving negative sentiment."
      }
    }
  }
  return posExecSummary || "" + negExecSummary || "";
}

const checkPatternOccurrenceRate = async (patternTotalCount, itemCount, patternThreshold) => {
  if ((itemCount / patternTotalCount) * 100 > patternThreshold)
    return true;
  else
    return false;
}

const fetchPatternsForSummary = async (patternCount, patternArray, patternThreshold) => {
  let finalArray = [];
  for (const [key, value] of Object.entries(patternArray)) {
    let thresholdPassed = false;
    if (value && value.count && value.label && value.count > 0) {
      thresholdPassed = await checkPatternOccurrenceRate(patternCount, value.count, patternThreshold);
    }
    if (thresholdPassed) {
      finalArray.push(value.label);
    }
  }
  return finalArray;
}

module.exports = {
  getAggregatedResults,
  constructExecutiveSummary,
  constructExecutiveSentimentSummary
}