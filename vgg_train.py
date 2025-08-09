# https://dataman-ai.medium.com/transfer-learning-for-image-classification-5-get-image-data-ready-and-go-554044a12e6d
# https://dataman-ai.medium.com/transfer-learning-for-image-classification-6-build-the-transfer-learning-model-67d87999af4a
# https://github.com/dataman-git/codes_for_articles/blob/master/20220804_Transfer_learning_for_Image_Classification.ipynb

import tensorflow as tf
import os

IMAGES_FOLDER = os.path.join('.', 'images')
IMAGE_SIZE = (224, 224)
IMAGE_SHAPE = (*IMAGE_SIZE, 3)
BATCH_SIZE = 32
NUM_EPOCHS = 15

# Load training and validation datasets
train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',           # binary labels: 0.0 or 1.0
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

test_ds = tf.keras.preprocessing.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

steps_per_epoch = len(train_ds)
validation_steps = len(test_ds)

# Load VGG16 base model
VGG16_features=tf.keras.applications.VGG16(input_shape=IMAGE_SHAPE,
                                           include_top=False,
                                           weights='imagenet')

# Freeze all layers except last conv layer
for layer in VGG16_features.layers:
    if layer.name in ['block5_conv3']:
        layer.trainable = True
    else:
        layer.trainable = False

# Custom classification head for binary classification
global_average_layer = tf.keras.layers.GlobalAveragePooling2D()
prediction_layer = tf.keras.layers.Dense(1, activation='sigmoid')  # 1 neuron for binary
fc1 = tf.keras.layers.Dense(64, activation='relu')

# Build the final model
model = tf.keras.Sequential([
  VGG16_features,
  global_average_layer,
  fc1,
  prediction_layer
])
model.summary()

# Compile for binary classification
model.compile(
    optimizer=tf.keras.optimizers.Adam(),
    loss=tf.keras.losses.BinaryCrossentropy(),
    metrics=["accuracy"]
)

# Train the model
history = model.fit(train_ds,
                    epochs=NUM_EPOCHS,
                    steps_per_epoch=steps_per_epoch,
                    validation_steps=validation_steps,
                    validation_data=test_ds)

# Save trained model
model.save(os.path.join('.', 'trained_binary_vgg'))

# Evaluate
loss0, accuracy0 = model.evaluate(test_ds, steps=validation_steps)
print("loss: {:.2f}".format(loss0))
print("accuracy: {:.2f}".format(accuracy0))
