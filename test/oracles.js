var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {


  // console.log('====================================');
  // console.log('\n        ----ACCOUNTS-----')
  // console.log(accounts);
  // console.log('====================================');

  const TEST_ORACLES_COUNT = 10;
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

  });


  it('can register oracles', async () => {
    

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 1; a < TEST_ORACLES_COUNT - 1; a++) {
      console.log('===========================================');
      console.log('\n     ---- ACCOUNT FOR ORACLE ----')
      console.log(accounts[a]);
      console.log('===========================================');
      await config.flightSuretyApp.registerOracle(
          { from: accounts[a], value: fee }
        );
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      console.log(`[${a}] Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can request flight status', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let requestIndex;

    console.log('====================================');
    console.log(config.firstAirline);
    console.log('====================================');

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);

    await config.flightSuretyApp.getPastEvents('OracleRequest', { fromBlock: 0, toBlock: 'latest' })
      .then(events => {
        const { index, airline, flight, timestamp } = events[0].returnValues;
        console.log('[OracleRequest]', index, airline, flight, timestamp);
        requestIndex = Number(index);
      });

    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      for (let idx = 0; idx < 3; idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.ownerAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, {
            from: accounts[a],
            gas: 4000000
          });
          console.log(`[${a}]`, '\nSuccess', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
        catch (e) {
          // Enable this when debugging
          let oracleIndex = oracleIndexes[idx].toNumber();
          console.log(`[${a}]`, '\nError', idx, oracleIndex, flight, timestamp);
          if (oracleIndex == requestIndex) console.log("[ERROR] ", e);
        }
      }

      await config.flightSuretyApp.getPastEvents('OracleReport', { fromBlock: 0 })
        .then((events) => {
          return events && events.length && events.forEach(event => {
            const { airline, flight, timestamp, status } = event.returnValues;
            assert(status, STATUS_CODE_LATE_AIRLINE, "Status should match earlier response");
            return console.log('[OracleReport]', airline, flight, timestamp, status, "LATE AIRLINE");
          });
        })
        .then(config.flightSuretyApp.getPastEvents('FlightStatusInfo', { fromBlock: 0 }))
        .then(events => {
          return events && events.length && events.forEach(event => {
            const { airline, flight, timestamp, status } = event.returnValues;
            assert(status, STATUS_CODE_LATE_AIRLINE, "Status should indicate delay");
            return console.log('*** [FlightStatusInfo] ***', airline, flight, timestamp, status, "LATE AIRLINE");
          });
        });
    }
  });



});