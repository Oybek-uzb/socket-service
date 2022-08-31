import {Process, Processor} from "@nestjs/bull";
import {Job} from "bull"


@Processor('my-queue')
export class AppConsumer {
    @Process('namedjob')
    async processNamedJob(job: Job<any>): Promise<any> {
        // do something with job and job.data
    }
}