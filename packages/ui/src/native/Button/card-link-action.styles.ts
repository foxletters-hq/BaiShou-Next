import { StyleSheet } from 'react-native'

export type CardLinkActionVariant = 'card' | 'footer'

export const cardLinkActionStyles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    justifyContent: 'center'
  },
  footer: {
    alignSelf: 'center',
    justifyContent: 'center'
  }
})
