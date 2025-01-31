import { Form, Input, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useLazyQuery, useMutation } from '@apollo/client'
import { ensureProtocol } from '../lib/url'
import ActionTooltip from '../components/action-tooltip'
import Countdown from './countdown'

export const LinkSchema = Yup.object({
  title: Yup.string().required('required').trim(),
  url: Yup.string().test({
    name: 'url',
    test: (value) => {
      try {
        value = ensureProtocol(value)
        const valid = new URL(value)
        return Boolean(valid)
      } catch {
        return false
      }
    },
    message: 'invalid url'
  }).required('required')
})

export function LinkForm ({ item, editThreshold }) {
  const [getPageTitle, { data }] = useLazyQuery(gql`
    query PageTitle($url: String!) {
      pageTitle(url: $url)
    }`)
  const router = useRouter()
  const [createLink] = useMutation(
    gql`
      mutation createLink($title: String!, $url: String!) {
        createLink(title: $title, url: $url) {
          id
        }
      }`
  )
  const [updateLink] = useMutation(
    gql`
      mutation updateLink($id: ID!, $title: String!, $url: String!) {
        updateLink(id: $id, title: $title, url: $url) {
          id
          title
          url
        }
      }`, {
      update (cache, { data: { updateLink } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            title () {
              return updateLink.title
            },
            url () {
              return updateLink.url
            }
          }
        })
      }
    }
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        url: item?.url || ''
      }}
      schema={LinkSchema}
      onSubmit={async (values) => {
        let id, error
        if (item) {
          ({ data: { updateLink: { id } }, error } = await updateLink({ variables: { ...values, id: item.id } }))
        } else {
          ({ data: { createLink: { id } }, error } = await createLink({ variables: values }))
        }
        if (error) {
          throw new Error({ message: error.toString() })
        }
        router.push(`/items/${id}`)
      }}
    >
      <Input
        label='title'
        name='title'
        overrideValue={data?.pageTitle}
        required
      />
      <Input
        label='url'
        name='url'
        required
        autoFocus
        hint={editThreshold
          ? <Countdown date={editThreshold} />
          : null}
        onChange={async (formik, e) => {
          if ((/^ *$/).test(formik?.values.title)) {
            getPageTitle({
              variables: { url: e.target.value }
            })
          }
        }}
      />
      <ActionTooltip>
        <SubmitButton variant='secondary' className='mt-2'>{item ? 'save' : 'post'}</SubmitButton>
      </ActionTooltip>
    </Form>
  )
}
