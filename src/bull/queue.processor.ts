import {InjectQueue, Process, Processor} from "@nestjs/bull";
import {Job, DoneCallback, Queue} from "bull"
import {Inject} from "@nestjs/common";
import Redis from "ioredis";
import {DatabaseService} from "../db/database.service";
import {ServerGateway} from "../socket/socket.gateway";

@Processor('order-processing')
export class OrderProcessingConsumer {
    private readonly skip_time;
    constructor(
        @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
        @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
        @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
        @Inject('REDIS_GEO_CLIENT') private readonly drivers: Redis,
        private readonly io: ServerGateway,
        private readonly db: DatabaseService,
    ) {
        this.skip_time = 20000;
    }
    @Process()
    async processNamedJob(job: Job<any>, done: DoneCallback): Promise<any> {
        if(job.data.attempts <= 10){
            let order_info = job.data
            order_info.attempts = parseInt(order_info.attempts) + 1
            order_info.jobId = "order-"+order_info.id+"-"+parseInt(order_info.attempts)
            await this.redisPubClient.set(`cityorder${job.data.id}`, JSON.stringify(order_info), 'EX', 4 * 60);
            await this.searchDriver(this.drivers, order_info, this.io)
            let lastjob = await job.queue.getJob(order_info.jobId);
            await lastjob?.remove();
            await job.queue.add(order_info, {
                jobId: order_info.jobId,
                delay: this.skip_time
            })
        }
        done()
    }

    async searchDriver(drivers, order_info, io): Promise<boolean> {
        let options = {
            withCoordinates: true,
            withHashes: false,
            withDistances: true,
            order: 'ASC',
            units: 'm',
            count: 20,
            accurate: true
        }
        let drivers_list = await this.nearbyCall(drivers, options, order_info)
        if (drivers_list.length == 0) {
            return false
        }
        let driver_id
        let driver_id_to_send = 0
        let driver_last_update
        let driver_tariff
        let driver_online
        let item
        for (let i = 0; i < drivers_list.length; i++) {
            item = drivers_list[i]
            driver_id = item.key.replace("driver_", "")
            driver_id = parseInt(driver_id)
            if (!isNaN(driver_id)) {
                driver_last_update = await this.redisAsyncClient.get(`driver_${driver_id}_location_last_update`);
                let driver_exists_in_order = await this.redisAsyncClient.get(`order_drivers_${order_info.id}`);
                if (driver_last_update !== null && driver_last_update >= Math.floor(new Date().getTime() / 1000) - 6000) {
                    if (driver_exists_in_order !== null && JSON.parse(driver_exists_in_order).includes(driver_id)) {
                        continue;
                    }
                    driver_online = await this.db.executeQuery(`SELECT id FROM driver_statuses WHERE user_id=${driver_id} AND driver_status='online'`);
                    if(driver_online.length == 0){
                        continue
                    }
                    driver_tariff = await this.db.executeQuery(`SELECT id FROM driver_enabled_tariffs WHERE user_id=${driver_id} AND is_active=true AND tariff_id=${order_info.tariff_id}`);
                    if(driver_tariff.length == 0){
                        continue
                    }
                    driver_id_to_send = driver_id
                    break;
                }
            }
        }
        if(order_info.attempts == 11){
            let sid = await this.redisAsyncClient.get(`sidclient${order_info.client_id}`);
            io.to(sid).emit(`client_orders`, {id: order_info.id,status:'driver_not_found'});
        }
        if (driver_id_to_send !== 0) {
            let socket_id = await this.redisAsyncClient.get(`siddriver${driver_id_to_send}`)
            let all_order_drivers = await this.redisAsyncClient.get(`order_drivers_${order_info.id}`);
            let all_order_drivers_arr = []
            if (all_order_drivers !== null) {
                all_order_drivers_arr = JSON.parse(all_order_drivers)
            }
            all_order_drivers_arr.push(driver_id_to_send)
            await this.redisPubClient.set(`order_drivers_${order_info.id}`, JSON.stringify(all_order_drivers_arr), 'EX', 5 * 60);
            console.log(driver_id_to_send)
            if (socket_id == null) {
                return await this.searchDriver(drivers, order_info, io)
            } else {
                await this.redisPubClient.set(`order_driver_${order_info.id}`, driver_id_to_send, 'EX', 60 * 60);
                io.to(socket_id).emit(`driver_orders`, order_info);
                return true
            }
        } else {
            return false
        }
    }

    nearbyCall(drivers, options, order_info): Promise<any> {
        return new Promise((resolve, reject) => {
            let lat_lon = order_info.from_loc.replace(/\s/g, "")
            let lat = lat_lon.split(",")[0]
            let lng = lat_lon.split(",")[1]
            drivers.nearby({latitude: lat, longitude: lng}, 5000, options, function (err, driver) {
                if (err) resolve([])
                else {
                    resolve(driver)
                }
            })
        })
    }
}