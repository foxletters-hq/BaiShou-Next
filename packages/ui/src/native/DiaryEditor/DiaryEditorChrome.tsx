import React from 'react'
import { View, TouchableOpacity, Text, Pressable, ActivityIndicator } from 'react-native'
import { ArrowLeft, Heart, Volume2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle'
import { WeatherPicker } from '../WeatherPicker/WeatherPicker'
import { MoodPicker } from '../MoodPicker/MoodPicker'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { diaryEditorStyles as styles } from './diary-editor.styles'

export function DiaryEditorChrome(props: {
  colors: {
    textPrimary: string
    textOnPrimary: string
    textSecondary: string
    textTertiary: string
    primary: string
    primaryLight: string
    warning: string
    bgSurface: string
    borderSubtle: string
  }
  isSummaryMode: boolean
  selectedDate: Date
  onDateChange: (date: Date) => void
  savePhase: 'idle' | 'saving' | 'leaving'
  weather: string
  mood: string
  isFavorite: boolean
  content: string
  isTtsPlaying: boolean
  onCancel?: () => void
  onSave?: () => void
  onWeatherChange?: (weather: string) => void
  onMoodChange?: (mood: string) => void
  onFavoriteChange?: (isFavorite: boolean) => void
  onReadAloud?: () => void
  snapKeyboardChromeAway: () => void
}) {
  const { t } = useTranslation()
  const { colors } = props

  return (
    <>
      <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            props.snapKeyboardChromeAway()
            props.onCancel?.()
          }}
        >
          <ArrowLeft size={24} color={colors.textPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </TouchableOpacity>

        <View style={styles.appBarCenter}>
          <DiaryEditorAppBarTitle
            isSummaryMode={props.isSummaryMode}
            selectedDate={props.selectedDate}
            onDateChanged={props.onDateChange}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            {
              backgroundColor: colors.primary,
              opacity: props.savePhase === 'idle' ? 1 : 0.85
            }
          ]}
          disabled={props.savePhase !== 'idle'}
          onPress={() => {
            props.snapKeyboardChromeAway()
            props.onSave?.()
          }}
        >
          {props.savePhase === 'saving' || props.savePhase === 'leaving' ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.textOnPrimary }]}>
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {!props.isSummaryMode &&
      (props.onWeatherChange || props.onMoodChange || props.onReadAloud) ? (
        <View style={[styles.metaBar, { borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.metaPickers}>
            {props.onWeatherChange ? (
              <WeatherPicker value={props.weather} onChange={props.onWeatherChange} />
            ) : null}
            {props.onMoodChange ? (
              <MoodPicker value={props.mood} onChange={props.onMoodChange} />
            ) : null}
            {props.onReadAloud ? (
              <Pressable
                style={({ pressed }) => [
                  styles.ttsBtn,
                  {
                    opacity: pressed ? 0.85 : 1,
                    backgroundColor: props.isTtsPlaying ? colors.primaryLight : colors.bgSurface,
                    borderColor: props.isTtsPlaying ? colors.primary : colors.borderSubtle
                  }
                ]}
                onPress={props.onReadAloud}
                disabled={!props.content.trim() && !props.isTtsPlaying}
                accessibilityLabel={t('agent.chat.readAloud', '语音朗读')}
              >
                {props.isTtsPlaying ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Volume2
                    size={20}
                    color={props.content.trim() ? colors.textSecondary : colors.textTertiary}
                    strokeWidth={DEFAULT_STROKE_WIDTH}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.favBtn,
              {
                opacity: pressed ? 0.85 : 1,
                backgroundColor: props.isFavorite ? colors.primaryLight : colors.bgSurface,
                borderColor: props.isFavorite ? colors.warning : colors.borderSubtle
              }
            ]}
            onPress={() => props.onFavoriteChange?.(!props.isFavorite)}
            accessibilityLabel={props.isFavorite ? t('diary.unfavorite') : t('diary.favorite')}
          >
            <Heart
              size={20}
              color={props.isFavorite ? colors.warning : colors.textTertiary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
              fill={props.isFavorite ? colors.warning : 'transparent'}
            />
          </Pressable>
        </View>
      ) : null}
    </>
  )
}
