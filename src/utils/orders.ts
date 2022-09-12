export async function searchDriver(
  drivers,
  order_info,
  io,
  redisAsyncClient,
  redisPubClient,
  db,
): Promise<boolean> {
  let options = {
    withCoordinates: true,
    withHashes: false,
    withDistances: true,
    order: 'ASC',
    units: 'm',
    count: 20,
    accurate: true,
  };
  let drivers_list = await nearbyCall(drivers, options, order_info);
  if (drivers_list.length == 0) {
    return false;
  }
  let driver_id;
  let driver_id_to_send = 0;
  let driver_last_update;
  let driver_tariff;
  let driver_online;
  let item;
  for (let i = 0; i < drivers_list.length; i++) {
    item = drivers_list[i];
    driver_id = item.key.replace('driver_', '');
    driver_id = parseInt(driver_id);
    if (!isNaN(driver_id)) {
      driver_last_update = await redisAsyncClient.get(
        `driver_${driver_id}_location_last_update`,
      );
      let driver_exists_in_order = await redisAsyncClient.get(
        `order_drivers_${order_info.id}`,
      );
      if (
        driver_last_update !== null &&
        driver_last_update >= Math.floor(new Date().getTime() / 1000) - 6000
      ) {
        if (
          driver_exists_in_order !== null &&
          JSON.parse(driver_exists_in_order).includes(driver_id)
        ) {
          continue;
        }
        driver_online = await db.executeQuery(
          `SELECT id FROM driver_statuses WHERE user_id=${driver_id} AND driver_status='online'`,
        );
        if (driver_online.length == 0) {
          continue;
        }
        driver_tariff = await db.executeQuery(
          `SELECT id FROM driver_enabled_tariffs WHERE user_id=${driver_id} AND is_active=true AND tariff_id=${order_info.tariff_id}`,
        );
        if (driver_tariff.length == 0) {
          continue;
        }
        driver_id_to_send = driver_id;
        break;
      }
    }
  }
  if (order_info.attempts == 11) {
    let sid = await redisAsyncClient.get(`sidclient${order_info.client_id}`);
    io.server.to(sid).emit(`client_orders`, {
      id: order_info.id,
      status: 'driver_not_found',
    });
  }
  if (driver_id_to_send !== 0) {
    let socket_id = await redisAsyncClient.get(`siddriver${driver_id_to_send}`);
    let all_order_drivers = await redisAsyncClient.get(
      `order_drivers_${order_info.id}`,
    );
    let all_order_drivers_arr = [];
    if (all_order_drivers !== null) {
      all_order_drivers_arr = JSON.parse(all_order_drivers);
    }
    all_order_drivers_arr.push(driver_id_to_send);
    await redisPubClient.set(
      `order_drivers_${order_info.id}`,
      JSON.stringify(all_order_drivers_arr),
      'EX',
      5 * 60,
    );
    console.log(driver_id_to_send);
    if (socket_id == null) {
      return await searchDriver(
        drivers,
        order_info,
        io,
        redisAsyncClient,
        redisPubClient,
        db,
      );
    } else {
      await redisPubClient.set(
        `order_driver_${order_info.id}`,
        driver_id_to_send,
        'EX',
        60 * 60,
      );
      io.server.to(socket_id).emit(`driver_orders`, order_info);
      return true;
    }
  } else {
    return false;
  }
}

export function nearbyCall(drivers, options, order_info): Promise<any> {
  return new Promise((resolve, reject) => {
    let lat_lon = order_info.from_loc.replace(/\s/g, '');
    let lat = lat_lon.split(',')[0];
    let lng = lat_lon.split(',')[1];
    drivers.nearby(
      { latitude: lat, longitude: lng },
      5000,
      options,
      function (err, driver) {
        if (err) resolve([]);
        else {
          resolve(driver);
        }
      },
    );
  });
}
