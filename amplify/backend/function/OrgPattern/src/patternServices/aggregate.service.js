const { getSearchQuery } = require("@commonutils/search");
const { getAggregationQuery, getAggregateResponse } = require("@commonutils/aggregate");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices } = require('@searchutils/models');

/**
 * Service function which holds business logic to perform aggregated queries on pattern index.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getAggregatedResults = async (orgId, filterOptions, periodFilter, aggregateOptions) => {
  let searchQuery;
  if(filterOptions){
    if(filterOptions?.filters?.length>0 || filterOptions?.mustNotFilters){
    searchQuery = getSearchQuery(Entities.patterns, filterOptions);
    }
  }
 
  const aggregationQuery = getAggregationQuery(Entities.patterns, aggregateOptions);
  const elasticQuery = {
    aggs: aggregationQuery
  };

  if(searchQuery){
    elasticQuery['query'] = searchQuery.query
  }
  console.info(JSON.stringify(elasticQuery));
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.patterns,
    body: elasticQuery
  });
  console.log("elastic response-", elasticResponse)
  return getAggregateResponse(aggregateOptions, elasticResponse);
};

module.exports = {
  getAggregatedResults
};