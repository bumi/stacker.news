import { AuthenticationError, UserInputError } from 'apollo-server-micro'
import AWS from 'aws-sdk'
import { IMAGE_PIXELS_MAX, UPLOAD_SIZE_MAX, UPLOAD_TYPES_ALLOW } from '../../lib/constants'

const bucketRegion = 'us-east-1'

AWS.config.update({
  region: bucketRegion
})

export default {
  Mutation: {
    getSignedPOST: async (parent, { type, size, width, height }, { models, me }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in to get a signed url')
      }

      if (UPLOAD_TYPES_ALLOW.indexOf(type) === -1) {
        throw new UserInputError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
      }

      if (size > UPLOAD_SIZE_MAX) {
        throw new UserInputError(`image must be less than ${UPLOAD_SIZE_MAX} bytes`)
      }

      if (width * height > IMAGE_PIXELS_MAX) {
        throw new UserInputError(`image must be less than ${IMAGE_PIXELS_MAX} pixels`)
      }

      // create upload record
      const upload = await models.upload.create({
        data: {
          type,
          size,
          width,
          height,
          userId: me.id
        }
      })

      // get presigned POST ur
      const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
      const res = await new Promise((resolve, reject) => {
        s3.createPresignedPost({
          Bucket: process.env.AWS_UPLOAD_BUCKET,
          Fields: {
            key: String(upload.id)
          },
          Expires: 300,
          Conditions: [
            { 'Content-Type': type },
            { acl: 'public-read' },
            ['content-length-range', size, size]
          ]
        }, (err, preSigned) => { if (err) { reject(err) } else { resolve(preSigned) } })
      })

      return res
    }
  }
}
